/**
 * Flexible payments engine - pure schedule math, no I/O.
 * Spec: docs/superpowers/specs/2026-07-09-flexible-payments-design.md
 *
 * Rules implemented here:
 *  1. $10K split: any draft over MAX_DRAFT_AMOUNT splits into consecutive
 *     business-day children ($10K chunks + remainder). Retainer/setup/program/
 *     escrow fill children in order; service/bank/legal fees ride ONLY the
 *     first child (charged once per week).
 *  2. Skip & push: skipping a pending draft shifts all later pending drafts
 *     forward one period.
 *  3. Amount edit + rebalance: the delta spreads equally across later pending
 *     drafts (last one absorbs rounding); totals never drift.
 */

export const MAX_DRAFT_AMOUNT = 10_000;

export interface EngineDraft {
  /** ISO date (yyyy-mm-dd) or Date. Normalized internally. */
  date: Date;
  amount: number;
  feeRetainer: number;
  feeProgram: number;
  feeSetup: number;
  feeService: number;
  feeBank: number;
  feeLegal: number;
  escrowAmount: number;
  splitGroupId?: string;
  splitIndex?: number;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Next business day strictly after d (skips Sat/Sun). */
export function nextBusinessDay(d: Date): Date {
  const out = new Date(d);
  do {
    out.setDate(out.getDate() + 1);
  } while (out.getDay() === 0 || out.getDay() === 6);
  return out;
}

/** First business day on-or-after d. */
export function toBusinessDay(d: Date): Date {
  const out = new Date(d);
  while (out.getDay() === 0 || out.getDay() === 6) out.setDate(out.getDate() + 1);
  return out;
}

/**
 * Split one over-limit draft into consecutive business-day children.
 * $10K chunks + remainder; money buckets fill children in order; weekly fees
 * (service/bank/legal) attach only to the first child.
 */
export function splitDraft(draft: EngineDraft, groupId: string): EngineDraft[] {
  if (draft.amount <= MAX_DRAFT_AMOUNT) return [draft];

  const children: EngineDraft[] = [];
  let remainingTotal = r2(draft.amount);
  let remRetainer = r2(draft.feeRetainer);
  let remSetup = r2(draft.feeSetup);
  let remProgram = r2(draft.feeProgram);
  let remEscrow = r2(draft.escrowAmount);
  let date = toBusinessDay(draft.date);
  let index = 0;

  while (remainingTotal > 0.004) {
    const amount = r2(Math.min(MAX_DRAFT_AMOUNT, remainingTotal));
    // Weekly fees ride the first child only.
    const feeService = index === 0 ? draft.feeService : 0;
    const feeBank = index === 0 ? draft.feeBank : 0;
    const feeLegal = index === 0 ? draft.feeLegal : 0;
    let capacity = r2(amount - feeService - feeBank - feeLegal);

    // Fill buckets in SF child-record order: retainer -> setup -> program -> escrow.
    const takeRetainer = r2(Math.min(remRetainer, capacity));
    capacity = r2(capacity - takeRetainer);
    const takeSetup = r2(Math.min(remSetup, capacity));
    capacity = r2(capacity - takeSetup);
    const takeProgram = r2(Math.min(remProgram, capacity));
    capacity = r2(capacity - takeProgram);
    const takeEscrow = r2(Math.min(remEscrow, capacity));

    children.push({
      date,
      amount,
      feeRetainer: takeRetainer,
      feeSetup: takeSetup,
      feeProgram: takeProgram,
      feeService,
      feeBank,
      feeLegal,
      escrowAmount: takeEscrow,
      splitGroupId: groupId,
      splitIndex: index,
    });

    remainingTotal = r2(remainingTotal - amount);
    remRetainer = r2(remRetainer - takeRetainer);
    remSetup = r2(remSetup - takeSetup);
    remProgram = r2(remProgram - takeProgram);
    remEscrow = r2(remEscrow - takeEscrow);
    date = nextBusinessDay(date);
    index++;
  }
  return children;
}

/** Apply the $10K rule across a whole schedule. groupSeed keeps ids stable/unique. */
export function applyTenKSplit(drafts: EngineDraft[], groupSeed = "split"): EngineDraft[] {
  const out: EngineDraft[] = [];
  drafts.forEach((d, i) => {
    out.push(...splitDraft(d, `${groupSeed}-${i}`));
  });
  return out;
}

/**
 * Skip & push: mark index `skipIdx` skipped; every LATER draft shifts forward
 * one period (periodDays, default 7). Returns the new dates for later drafts.
 */
export function planSkip<T extends { date: Date }>(
  pending: T[],
  skipIdx: number,
  periodDays = 7,
): { shifted: { item: T; newDate: Date }[] } {
  const shifted: { item: T; newDate: Date }[] = [];
  for (let i = skipIdx + 1; i < pending.length; i++) {
    const nd = new Date(pending[i].date);
    nd.setDate(nd.getDate() + periodDays);
    shifted.push({ item: pending[i], newDate: toBusinessDay(nd) });
  }
  return { shifted };
}

/**
 * Amount edit + rebalance: change pending[editIdx] to newAmount; spread the
 * difference equally over the LATER pending drafts (last absorbs rounding).
 * Only the escrow bucket flexes - fees stay glued to their week.
 * Returns new amounts (same order as input); throws if any draft would go
 * below its fee floor.
 */
export function planAmountEdit(
  pending: { amount: number; fees: number }[],
  editIdx: number,
  newAmount: number,
): { newAmounts: number[] } {
  const later = pending.length - editIdx - 1;
  if (later < 1) throw new Error("No later payments to rebalance into - edit the program instead.");
  const delta = r2(pending[editIdx].amount - newAmount); // + means others must absorb more
  if (newAmount < pending[editIdx].fees) {
    throw new Error(`Amount can't go below this week's fees ($${pending[editIdx].fees.toFixed(2)}).`);
  }

  const newAmounts = pending.map((p) => p.amount);
  newAmounts[editIdx] = r2(newAmount);

  const per = r2(delta / later);
  let distributed = 0;
  for (let i = editIdx + 1; i < pending.length; i++) {
    const isLast = i === pending.length - 1;
    const add = isLast ? r2(delta - distributed) : per;
    const next = r2(pending[i].amount + add);
    if (next < pending[i].fees) {
      throw new Error("Rebalance would push a later payment below its fees - change a smaller amount.");
    }
    newAmounts[i] = next;
    distributed = r2(distributed + add);
  }
  return { newAmounts };
}
