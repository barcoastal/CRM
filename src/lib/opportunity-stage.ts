/**
 * Opportunity stage automation, mirrors the SF flows:
 *   contract sent to the client  -> stage "Contract Sent"
 *   client completes signing     -> stage "Contract Signed"
 *
 * Advancement is FORWARD-ONLY: if the deal is already at or past the target
 * stage (e.g. Closed Won), nothing changes. Off-path stages (Archived, Closed
 * Lost) are left alone too - reactivation is a human decision.
 */
import { prisma } from "@/lib/prisma";

const ORDER = [
  "Working Opportunity",
  "Waiting for Agreements",
  "Agreements Received",
  "Ready To Close",
  "Contract Sent",
  "Contract Signed",
  "Closed Won First Payment Pending",
  "Closed Won - First Payment Completed",
] as const;

function norm(s: string): string {
  return s.replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function rank(stage: string | null | undefined): number {
  if (!stage) return -1;
  const n = norm(stage);
  return ORDER.findIndex((o) => norm(o) === n);
}

/**
 * Move the opportunity to `target` if that is a forward move on the happy
 * path. Records OpportunityHistory. Silent no-op on any failure - stage
 * automation must never break the send/sign flows.
 */
export async function advanceOppStage(
  opportunityId: string,
  target: (typeof ORDER)[number],
  changedById?: string | null,
): Promise<void> {
  try {
    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, stage: true },
    });
    if (!opp) return;
    const cur = rank(opp.stage);
    const tgt = rank(target);
    // Only advance when the current stage is ON the happy path and BEFORE the
    // target. Off-path (Archived/Closed Lost, cur === -1): leave alone.
    if (cur === -1 || tgt === -1 || cur >= tgt) return;

    await prisma.opportunity.update({ where: { id: opp.id }, data: { stage: target } });
    await prisma.opportunityHistory
      .create({
        data: {
          opportunityId: opp.id,
          field: "stage",
          oldValue: opp.stage,
          newValue: target,
          changedById: changedById ?? null,
        },
      })
      .catch(() => undefined);
  } catch {
    // never break the caller
  }
}
