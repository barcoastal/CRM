import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { signedDir } from "@/lib/esign/storage";
import { sha256 } from "@/lib/esign/evidence";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { authenticateSalesforcePilot } from "@/lib/esign/salesforce/auth";
import { sourceSchema } from "@/lib/esign/salesforce/policy";
export async function GET(
  req: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  const pilot = await authenticateSalesforcePilot(req.headers);
  if (!pilot)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await c.params;
  const p = await prisma.signingPacket.findFirst({
    where: { id, createdById: pilot.senderUserId },
    include: {
      envelopes: {
        orderBy: { routingOrder: "asc" },
        select: { id: true, status: true, sentAt: true, completedAt: true },
      },
    },
  });
  const source = sourceSchema.safeParse(p?.salesforceSource);
  if (
    !p ||
    !source.success ||
    source.data.orgId !== pilot.orgId ||
    source.data.opportunityId !== pilot.opportunityId
  )
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (req.nextUrl.searchParams.get("download") === "true") {
    if (p.status !== "COMPLETED" || !p.completedPdfPath)
      return NextResponse.json(
        { error: "Packet is not completed" },
        { status: 409 },
      );
    const pdf = await readFile(path.join(signedDir(), p.completedPdfPath));
    const last = p.envelopes.at(-1);
    const event =
      last &&
      (await prisma.envelopeEvent.findFirst({
        where: { envelopeId: last.id, eventType: "COMPLETED" },
        orderBy: { createdAt: "desc" },
      }));
    let hash = "";
    try {
      hash = JSON.parse(event?.details ?? "{}").signedSha256 ?? "";
    } catch {}
    if (!hash || hash !== sha256(pdf))
      return NextResponse.json(
        { error: "Completed PDF integrity check failed" },
        { status: 409 },
      );
    if (pdf.length > 3500000)
      return NextResponse.json(
        {
          error:
            "Completed PDF exceeds the sandbox transfer limit. Download it in the E-Sign Center.",
        },
        { status: 413 },
      );
    return NextResponse.json({
      id: p.id,
      pdfBase64: pdf.toString("base64"),
      filename: `Coastal-E-Sign-TEST-${p.id}.pdf`,
    });
  }
  return NextResponse.json({
    id: p.id,
    status: p.status,
    recipients: p.envelopes,
    opportunityId: source.data.opportunityId,
  });
}
