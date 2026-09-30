import { prisma } from "@/lib/prisma";
import { packetConfigSchema } from "./packet-config";
import {
  advancePacket,
  deliverPacketInvitation,
  deliverCompletedPacket,
} from "./packet-routing";
export async function runSigningJobs() {
  const packets = await prisma.signingPacket.findMany({
    where: {
      OR: [
        { status: { in: ["SENT", "SENDING"] } },
        { status: "COMPLETED", completedDeliveryAt: null },
      ],
    },
    take: 200,
    orderBy: { updatedAt: "asc" },
  });
  let reminders = 0;
  for (const p of packets) {
    await prisma.signingPacket.update({
      where: { id: p.id },
      data: { lastReminderAt: new Date() },
    });
    if (p.status === "COMPLETED") {
      await deliverCompletedPacket(p.id).catch(() => {});
      continue;
    }
    await advancePacket(p.id).catch(() => {});
    const config = packetConfigSchema.safeParse(p.config);
    if (!config.success) continue;
    const active = await prisma.envelope.findFirst({
      where: { packetId: p.id, status: { in: ["SENT", "VIEWED"] } },
    });
    if (!active) continue;
    if (active.expiresAt && active.expiresAt <= new Date()) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${p.id}))`;
        const changed = await tx.envelope.updateMany({
          where: {
            id: active.id,
            status: { in: ["SENT", "VIEWED"] },
            expiresAt: { lte: new Date() },
          },
          data: { status: "EXPIRED" },
        });
        if (changed.count) {
          await tx.envelopeEvent.create({
            data: {
              envelopeId: active.id,
              eventType: "EXPIRED",
              details: "Signing deadline reached",
            },
          });
          await tx.signingPacket.updateMany({
            where: { id: p.id, status: { in: ["SENT", "SENDING"] } },
            data: { status: "EXPIRED" },
          });
        }
      });
      continue;
    }
    if (active.lastError) {
      const claim = active.lastError.startsWith("Reminder")
        ? await prisma.envelopeEvent.findFirst({
            where: { envelopeId: active.id, eventType: "REMINDER_CLAIMED" },
            orderBy: { createdAt: "desc" },
          })
        : null;
      await deliverPacketInvitation(
        active.id,
        claim?.details ?? undefined,
      ).catch(() => {});
      continue;
    }
    if (!config.data.reminderDays) continue;
    const key = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${active.id}))`;
      const last = await tx.envelopeEvent.findFirst({
        where: {
          envelopeId: active.id,
          eventType: { in: ["REMINDER_CLAIMED", "REMINDER_SENT"] },
        },
        orderBy: { createdAt: "desc" },
      });
      const base = last?.createdAt ?? active.sentAt ?? new Date();
      if (Date.now() - base.getTime() < config.data.reminderDays * 86400000)
        return null;
      const key = `reminder-${active.id}-${new Date().toISOString().slice(0, 10)}`;
      await tx.envelopeEvent.create({
        data: {
          envelopeId: active.id,
          eventType: "REMINDER_CLAIMED",
          details: key,
        },
      });
      return key;
    });
    if (key) {
      await deliverPacketInvitation(active.id, key).catch(() => {});
      reminders++;
    }
  }
  return { checked: packets.length, reminders };
}
