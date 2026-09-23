import type { Opportunity } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { enrollInCadence } from "@/lib/cadences";

export async function syncOpportunityCadences(row: Opportunity, prev: Opportunity) {
  if (process.env.ENABLE_OPPORTUNITY_CADENCES !== "true") return;
  const welcomeChanged = row.welcomeCallScheduled?.getTime() !== prev.welcomeCallScheduled?.getTime();
  const contractEntered = row.stage === "Closed Won First Payment Pending" && prev.stage !== row.stage;
  if (!welcomeChanged && !contractEntered) return;
  const key = `welcome-call:${row.id}`;
  if (welcomeChanged) {
    // A moved/cancelled appointment must not leave a stale reminder pending.
    await prisma.cadenceEnrollment.updateMany({
      where: { automationKey: key, currentStepOrder: 0, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { status: "UNENROLLED", nextRunAt: null },
    });
  }
  if (!row.accountId) return;
  const account = await prisma.account.findUnique({ where: { id: row.accountId }, select: { primaryContactId: true, ownerId: true } });
  if (!account?.primaryContactId) return;
  if (welcomeChanged && row.welcomeCallScheduled) {
    await enrollNamed("Welcome Call", row, account.primaryContactId, account.ownerId, key,
      new Date(row.welcomeCallScheduled.getTime() - 86_400_000), row.welcomeCallScheduled);
  }
  if (contractEntered) {
    const manager = await prisma.user.findFirst({
      where: { email: { equals: process.env.CONTRACT_CADENCE_OWNER_EMAIL || "ferron@coastaldebt.com", mode: "insensitive" }, isActive: true },
      select: { id: true },
    });
    if (!manager) {
      await logMissing(row.id, "Contract Signed cadence owner is not mapped to an active user");
      return;
    }
    await enrollNamed("Contract Signed", row, account.primaryContactId, manager.id, `contract-signed:${row.id}`);
  }
}

async function logMissing(id: string, message: string) {
  await prisma.applicationLog.create({ data: { source: "opportunity-cadences", level: "WARN", message, payload: { opportunityId: id } } });
}

async function enrollNamed(name: string, row: Opportunity, contactId: string, ownerId: string | null,
  automationKey: string, startAt?: Date, scheduledFor?: Date) {
  const cadence = await prisma.callCadence.findUnique({ where: { name }, include: { steps: { take: 1 } } });
  if (!cadence?.isActive || !cadence.steps.length || !ownerId) {
    await logMissing(row.id, `${name} requires an active cadence with steps and a mapped owner`);
    return;
  }
  await enrollInCadence({ cadenceId: cadence.id, opportunityId: row.id, accountId: row.accountId!, contactId,
    enrolledById: ownerId, automationKey, startAt, scheduledFor });
}
