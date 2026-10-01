import { sandboxRecipientError } from "@/lib/esign/salesforce/policy";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { requirePacketAuth } from "@/lib/esign/salesforce/embed";
import { packetConfigSchema, packetErrors } from "@/lib/esign/packet-config";
import { verifiedPreparedPdf } from "@/lib/esign/evidence";
import {
  advancePacket,
  deliverPacketInvitation,
  recipientBoxes,
} from "@/lib/esign/packet-routing";
export async function POST(
  req: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  const { id } = await c.params;
  const auth = await requirePacketAuth(req, id, "Opportunity.Edit");
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  const p = await prisma.signingPacket.findFirst({
    where: { id, createdById: auth.session.userId },
    include: { envelopes: true },
  });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body?.retry === true) {
    const active = p.envelopes.find((e) =>
      ["SENT", "VIEWED"].includes(e.status),
    );
    if (active) {
      const result = await deliverPacketInvitation(active.id);
      return NextResponse.json(
        {
          ok: result.ok,
          emailSent: result.ok,
          error: result.ok ? undefined : "Delivery failed.",
        },
        { status: result.ok ? 200 : 502 },
      );
    }
    if (["SENT", "SENDING"].includes(p.status)) {
      await advancePacket(id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "No invitation is awaiting delivery" },
      { status: 409 },
    );
  }
  if (p.status !== "DRAFT" || p.revision !== body?.revision)
    return NextResponse.json(
      { error: "Draft changed or has already been sent." },
      { status: 409 },
    );
  const parsed = packetConfigSchema.safeParse(p.config);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Complete recipients and settings first." },
      { status: 400 },
    );
  const config = parsed.data;
  const pilotError = sandboxRecipientError(p.salesforceSource, config);
  if (pilotError)
    return NextResponse.json({ error: pilotError }, { status: 400 });
  const { bytes } = await verifiedPreparedPdf(p.preparedPdfPath);
  const pdf = await PDFDocument.load(bytes);
  const errors = packetErrors(
    config,
    pdf.getPages().map((p) => p.getSize()),
  );
  if (errors.length)
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  try {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.signingPacket.updateMany({
        where: { id, status: "DRAFT", revision: body.revision },
        data: { status: "SENDING" },
      });
      if (changed.count !== 1) throw new Error("Draft changed");
      for (const r of config.recipients.filter((r) => r.action === "SIGN")) {
        const e = await tx.envelope.create({
          data: {
            packetId: id,
            routingOrder: r.order,
            status: "DRAFT",
            createdById: auth.session.userId,
            signerName: r.name,
            signerEmail: r.email,
            signingToken: randomBytes(32).toString("hex"),
            documentName: p.name,
            pages: pdf.getPageCount(),
            ...recipientBoxes(config, r.id),
          },
        });
        await tx.envelopeEvent.create({
          data: {
            envelopeId: e.id,
            eventType: "CREATED",
            details: JSON.stringify({ packetId: id, routingOrder: r.order }),
          },
        });
      }
    });
  } catch {
    return NextResponse.json(
      { error: "This packet was changed or sent by another session." },
      { status: 409 },
    );
  }
  try {
    const result = await advancePacket(id);
    return NextResponse.json(
      {
        ok: result.ok,
        emailSent: result.ok,
        packetId: id,
        error: result.ok
          ? undefined
          : "Invitation delivery failed. Retry from this packet.",
      },
      { status: result.ok ? 200 : 502 },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Packet saved, but sending could not finish. Retry from this packet.",
      },
      { status: 502 },
    );
  }
}
