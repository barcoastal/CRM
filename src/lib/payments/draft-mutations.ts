/**
 * Flexible payments - persisted Draft mutations. Wraps the pure engine in
 * prisma transactions and marks affected drafts processorSyncStatus=PENDING
 * so the (upcoming) SAS/RAM client can drain the queue.
 */
import { prisma } from "@/lib/prisma";
import { planSkip, planAmountEdit, splitDraft, toBusinessDay, nextBusinessDay, MAX_DRAFT_AMOUNT } from "./draft-engine";

const PENDING_STATUSES = ["SCHEDULED", "RETRYING"];

async function pendingDrafts(programPlanId: string) {
  return prisma.draft.findMany({
    where: { programPlanId, status: { in: PENDING_STATUSES } },
    orderBy: { scheduledDate: "asc" },
  });
}

/** Skip a pending draft; push every later pending draft forward one period. */
export async function skipDraft(draftId: string, periodDays = 7): Promise<{ shiftedCount: number }> {
  const draft = await prisma.draft.findUnique({ where: { id: draftId } });
  if (!draft) throw new Error("Draft not found");
  if (!PENDING_STATUSES.includes(draft.status)) throw new Error(`Only pending drafts can be skipped (this one is ${draft.status}).`);

  const pending = await pendingDrafts(draft.programPlanId);
  const idx = pending.findIndex((d) => d.id === draftId);
  const { shifted } = planSkip(
    pending.map((d) => ({ id: d.id, date: d.scheduledDate })),
    idx,
    periodDays,
  );

  await prisma.$transaction([
    prisma.draft.update({
      where: { id: draftId },
      data: { status: "SKIPPED", skippedAt: new Date(), processorSyncStatus: "PENDING" },
    }),
    ...shifted.map(({ item, newDate }) =>
      prisma.draft.update({
        where: { id: (item as { id: string }).id },
        data: { scheduledDate: newDate, processorSyncStatus: "PENDING" },
      }),
    ),
  ]);
  return { shiftedCount: shifted.length };
}

/**
 * Change a pending draft's amount; redistribute the delta across later pending
 * drafts. If the new amount exceeds $10K the draft is split into business-day
 * children.
 */
export async function editDraftAmount(draftId: string, newAmount: number): Promise<{ rebalanced: number; split: boolean }> {
  if (!(newAmount > 0)) throw new Error("Amount must be positive");
  const draft = await prisma.draft.findUnique({ where: { id: draftId } });
  if (!draft) throw new Error("Draft not found");
  if (!PENDING_STATUSES.includes(draft.status)) throw new Error(`Only pending drafts can be edited (this one is ${draft.status}).`);

  const pending = await pendingDrafts(draft.programPlanId);
  const idx = pending.findIndex((d) => d.id === draftId);
  const fees = (d: (typeof pending)[number]) => d.feeRetainer + d.feeProgram + d.feeSetup + d.feeService + d.feeBank + d.feeLegal;

  const { newAmounts } = planAmountEdit(
    pending.map((d) => ({ amount: d.amount, fees: d.id === draftId ? fees(d) - d.feeRetainer - d.feeProgram - d.feeSetup : fees(d) })),
    idx,
    newAmount,
  );

  // Escrow flexes with the amount; fee columns stay glued to their week.
  const updates = pending.map((d, i) => {
    if (newAmounts[i] === d.amount) return null;
    const escrow = Math.round((newAmounts[i] - fees(d)) * 100) / 100;
    return prisma.draft.update({
      where: { id: d.id },
      data: { amount: newAmounts[i], escrowAmount: Math.max(0, escrow), processorSyncStatus: "PENDING" },
    });
  });

  await prisma.$transaction(updates.filter((u): u is NonNullable<typeof u> => u !== null));

  // Re-split if the edited draft went over the cap.
  let split = false;
  if (newAmount > MAX_DRAFT_AMOUNT) {
    split = true;
    const fresh = await prisma.draft.findUnique({ where: { id: draftId } });
    if (fresh) {
      const children = splitDraft(
        {
          date: fresh.scheduledDate,
          amount: fresh.amount,
          feeRetainer: fresh.feeRetainer,
          feeProgram: fresh.feeProgram,
          feeSetup: fresh.feeSetup,
          feeService: fresh.feeService,
          feeBank: fresh.feeBank,
          feeLegal: fresh.feeLegal,
          escrowAmount: fresh.escrowAmount,
        },
        `split-${fresh.id}`,
      );
      if (children.length > 1) {
        await prisma.$transaction([
          // Parent becomes the first child in place...
          prisma.draft.update({
            where: { id: fresh.id },
            data: {
              amount: children[0].amount,
              feeRetainer: children[0].feeRetainer,
              feeProgram: children[0].feeProgram,
              feeSetup: children[0].feeSetup,
              feeService: children[0].feeService,
              feeBank: children[0].feeBank,
              feeLegal: children[0].feeLegal,
              escrowAmount: children[0].escrowAmount,
              splitGroupId: `split-${fresh.id}`,
              splitIndex: 0,
              processorSyncStatus: "PENDING",
            },
          }),
          // ...and the rest are new sibling drafts on following business days.
          ...children.slice(1).map((c) =>
            prisma.draft.create({
              data: {
                programPlanId: fresh.programPlanId,
                debitScheduleId: fresh.debitScheduleId,
                scheduledDate: c.date,
                amount: c.amount,
                feeRetainer: c.feeRetainer,
                feeProgram: c.feeProgram,
                feeSetup: c.feeSetup,
                feeService: c.feeService,
                feeBank: c.feeBank,
                feeLegal: c.feeLegal,
                escrowAmount: c.escrowAmount,
                splitGroupId: c.splitGroupId,
                splitIndex: c.splitIndex,
                kind: fresh.kind,
                processorSyncStatus: "PENDING",
              },
            }),
          ),
        ]);
      }
    }
  }
  return { rebalanced: updates.filter(Boolean).length, split };
}

/** Ad-hoc "charge now": a one-off MANUAL draft on the next business day. */
export async function manualCharge(
  programPlanId: string,
  amount: number,
  opts?: { date?: Date; note?: string },
): Promise<{ draftIds: string[] }> {
  if (!(amount > 0)) throw new Error("Amount must be positive");
  const plan = await prisma.programPlan.findUnique({ where: { id: programPlanId }, select: { id: true } });
  if (!plan) throw new Error("Program plan not found");

  const startDate = opts?.date ? toBusinessDay(opts.date) : nextBusinessDay(new Date());
  // Manual charges obey the $10K rule too.
  const pieces = splitDraft(
    {
      date: startDate,
      amount,
      feeRetainer: 0,
      feeProgram: 0,
      feeSetup: 0,
      feeService: 0,
      feeBank: 0,
      feeLegal: 0,
      escrowAmount: amount,
    },
    `manual-${Date.now()}`,
  );

  const created = await prisma.$transaction(
    pieces.map((p) =>
      prisma.draft.create({
        data: {
          programPlanId,
          scheduledDate: p.date,
          amount: p.amount,
          escrowAmount: p.escrowAmount,
          splitGroupId: pieces.length > 1 ? p.splitGroupId : null,
          splitIndex: pieces.length > 1 ? p.splitIndex : null,
          kind: "MANUAL",
          processorSyncStatus: "PENDING",
          notes: opts?.note ?? "Manual charge",
        },
      }),
    ),
  );
  return { draftIds: created.map((d) => d.id) };
}
