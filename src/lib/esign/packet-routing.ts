import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { saveEnvelopePdf, signedDir } from "./storage";
import { sha256, verifiedPreparedPdf } from "./evidence";
import { packetConfigSchema, type PacketConfig } from "./packet-config";
import { sendPacketInvitation } from "./packet-email";
import { sendESignEmail } from "./send-email";
import { advanceOppStage } from "@/lib/opportunity-stage";

export async function deliverPacketInvitation(
  envelopeId: string,
  reminderKey?: string,
) {
  const e = await prisma.envelope.findUnique({
    where: { id: envelopeId },
    include: {
      packet: true,
      createdBy: { select: { name: true, email: true } },
    },
  });
  if (
    !e?.packet ||
    !["SENT", "VIEWED"].includes(e.status) ||
    (e.expiresAt && e.expiresAt <= new Date())
  )
    return { ok: false, error: "Envelope is unavailable" };
  const config = packetConfigSchema.parse(e.packet.config);
  const r = await sendPacketInvitation({
    email: e.signerEmail,
    senderName: e.createdBy?.name ?? "Coastal Debt Resolve",
    senderEmail: e.createdBy?.email ?? "",
    subject: reminderKey ? `Reminder: ${config.subject}` : config.subject,
    message: config.message,
    token: e.signingToken,
    idempotencyKey: reminderKey ?? `packet-invite-${e.id}`,
  });
  await prisma.envelopeEvent.create({
    data: {
      envelopeId: e.id,
      eventType: r.ok
        ? reminderKey
          ? "REMINDER_SENT"
          : "EMAIL_SENT"
        : "EMAIL_FAILED",
      details: r.ok
        ? JSON.stringify({
            providerMessageId: r.providerMessageId,
            to: e.signerEmail,
          })
        : r.error,
    },
  });
  await prisma.envelope.updateMany({
    where: { id: e.id, status: { in: ["SENT", "VIEWED"] } },
    data: {
      lastError: r.ok
        ? null
        : reminderKey
          ? "Reminder delivery failed."
          : "Invitation delivery failed. Retry from the packet screen.",
    },
  });
  return r;
}
/** One active signer at a time. Each receives an immutable PDF containing the prior signatures. */
export async function advancePacket(packetId: string) {
  const action = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${packetId}))`;
      const p = await tx.signingPacket.findUnique({
        where: { id: packetId },
        include: { envelopes: { orderBy: { routingOrder: "asc" } } },
      });
      if (!p || !["SENT", "SENDING"].includes(p.status)) return null;
      if (p.envelopes.some((e) => ["DECLINED", "VOIDED"].includes(e.status))) {
        await tx.signingPacket.update({
          where: { id: packetId },
          data: { status: "DECLINED" },
        });
        return null;
      }
      if (p.envelopes.some((e) => ["SENT", "VIEWED"].includes(e.status)))
        return null;
      const next = p.envelopes.find((e) => e.status === "DRAFT");
      const last = p.envelopes.filter((e) => e.status === "COMPLETED").at(-1);
      if (!next) {
        if (!last) return null;
        await tx.signingPacket.update({
          where: { id: packetId },
          data: {
            status: "COMPLETED",
            completedPdfPath: last.signedDocumentUrl,
          },
        });
        return { completed: true, packet: p, last };
      }
      let bytes: Buffer;
      if (last?.signedDocumentUrl) {
        bytes = await fs.readFile(
          path.join(signedDir(), last.signedDocumentUrl),
        );
        const event = await tx.envelopeEvent.findFirst({
          where: { envelopeId: last.id, eventType: "COMPLETED" },
          orderBy: { createdAt: "desc" },
        });
        if (JSON.parse(event?.details ?? "{}").signedSha256 !== sha256(bytes))
          throw new Error(
            "Previous signer document failed integrity verification",
          );
      } else bytes = (await verifiedPreparedPdf(p.preparedPdfPath)).bytes;
      let preparedPdfPath: string;
      // A retry may encounter a snapshot saved before a process interruption.
      try {
        preparedPdfPath = await saveEnvelopePdf(bytes, next.id);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
        const existing = await verifiedPreparedPdf(`${next.id}.pdf`);
        if (existing.hash !== sha256(bytes))
          throw new Error("Snapshot conflict");
        preparedPdfPath = `${next.id}.pdf`;
      }
      const c = packetConfigSchema.parse(p.config);
      const now = new Date();
      await tx.envelope.update({
        where: { id: next.id },
        data: {
          status: "SENT",
          preparedPdfPath,
          sentAt: now,
          expiresAt: new Date(now.getTime() + c.expiresDays * 86400000),
          lastError: "Invitation pending delivery",
        },
      });
      await tx.envelopeEvent.create({
        data: {
          envelopeId: next.id,
          eventType: "SENT",
          details: JSON.stringify({
            recipient: next.signerEmail,
            preparedSha256: sha256(bytes),
            previousEnvelopeId: last?.id ?? null,
          }),
        },
      });
      await tx.signingPacket.update({
        where: { id: packetId },
        data: { status: "SENT" },
      });
      return { envelopeId: next.id };
    },
    { timeout: 20000 },
  );
  if (action && "envelopeId" in action && action.envelopeId)
    return deliverPacketInvitation(action.envelopeId);
  if (action && "completed" in action && action.completed)
    await deliverCompletedPacket(packetId);
  return { ok: true };
}
export function recipientBoxes(c: PacketConfig, id: string) {
  const boxes = (kind: string) =>
    c.fields
      .filter((f) => f.recipientId === id && f.kind === kind)
      .map(({ page, x, y, width, height, label, required }) => ({
        page,
        x,
        y,
        width,
        height,
        label,
        required,
      }));
  return {
    signatureBoxes: boxes("signature"),
    initialBoxes: boxes("initial"),
    dateBoxes: boxes("date"),
    textBoxes: c.fields
      .filter((f) => f.recipientId === id && ["name", "text"].includes(f.kind))
      .map((f) => ({
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        label: f.kind === "name" ? "Full name" : (f.label ?? "Text"),
        required: f.required,
        inputType: f.inputType,
        options: f.options,
      })),
    checkboxBoxes: boxes("checkbox"),
  };
}

/** Retryable final delivery; provider idempotency and durable events avoid duplicates. */
export async function deliverCompletedPacket(packetId: string) {
  const packet = await prisma.signingPacket.findUnique({
    where: { id: packetId },
    include: { envelopes: { orderBy: { routingOrder: "asc" } } },
  });
  if (!packet || packet.status !== "COMPLETED" || packet.completedDeliveryAt)
    return;
  const last = packet.envelopes.at(-1);
  if (!last) return;
  const c = packetConfigSchema.parse(packet.config);
  const root = (
    process.env.NEXTAUTH_URL ?? "https://crm.coastaldebt-tools.com"
  ).replace(/\/$/, "");
  for (const to of [...new Set(c.recipients.map((r) => r.email))]) {
    const key = `packet-completed-${packet.id}-${sha256(to).slice(0, 16)}`;
    if (
      await prisma.envelopeEvent.findFirst({
        where: {
          envelopeId: last.id,
          eventType: "PACKET_COPY_SENT",
          details: key,
        },
      })
    )
      continue;
    const r = await sendESignEmail({
      from: process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>",
      to,
      subject: `Completed: ${c.subject}`,
      html: `<p>All required signers have completed your documents.</p><p><a href="${root}/api/esign/envelopes/by-token/${last.signingToken}/signed-pdf">Download the completed packet</a></p>`,
      idempotencyKey: key,
    });
    if (!r.ok) throw new Error("Completed packet email delivery failed");
    await prisma.envelopeEvent.create({
      data: {
        envelopeId: last.id,
        eventType: "PACKET_COPY_SENT",
        details: key,
      },
    });
  }
  if (packet.opportunityId)
    await advanceOppStage(packet.opportunityId, "Contract Signed", null);
  await prisma.signingPacket.update({
    where: { id: packetId },
    data: { completedDeliveryAt: new Date() },
  });
}
