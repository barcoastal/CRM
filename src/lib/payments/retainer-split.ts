/**
 * Split Retainer and Setup Fee — port of SF programPlans' split feature.
 *
 * The upfront retainer + setup fee can be split across N payments.
 * SF: count = round((retainer + setup) / weekly draft). Each row carries a bank
 * fee (monthly bank once per new month + bank-setup on the first row) and a
 * citadel fee (once per new month, skipping the first month). The total
 * (retainer + setup + bank + citadel) is spread evenly across the N dates.
 */

export type SplitRow = { date: string; amount: number; bankFee: number; citadelFee: number; setupFee: number };

export type SplitParams = {
  retainerAmount: number;
  setupFee: number;
  citadelFee: number;
  monthlyBankFee: number;
  bankSetupFee: number;
  weeklyDraft: number;
  firstPaymentDate: string;
  weeklyPaymentDay: string;
  /** $995 legal plan puts setup on row 0; else on row 1 (SF calculateSetupFee). */
  legalPlanRequired?: boolean;
};

const WEEKDAY: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;

function splitDates(count: number, firstPaymentDate: string, weeklyPaymentDay: string): Date[] {
  const offset = WEEKDAY[weeklyPaymentDay] ?? 5;
  const out: Date[] = [];
  let d = new Date(firstPaymentDate);
  for (let i = 0; i < count; i++) {
    if (i === 0) out.push(new Date(d));
    else {
      const n = new Date(d);
      n.setUTCDate(n.getUTCDate() + 7);
      n.setUTCDate(n.getUTCDate() - n.getUTCDay() + offset);
      out.push(n);
      d = n;
    }
  }
  return out;
}

/** Auto Split: the exact SF row set (count, per-row fees, even payment amount). */
export function computeSplit(p: SplitParams): SplitRow[] {
  const count = Math.max(1, Math.round((p.retainerAmount + p.setupFee) / (p.weeklyDraft || 1)));
  const dates = splitDates(count, p.firstPaymentDate, p.weeklyPaymentDay);
  const seenBank = new Set<string>();
  const seenCit = new Set<string>();
  if (dates.length) seenCit.add(monthKey(dates[0])); // citadel skips the first month
  const fees = dates.map((d, i) => {
    const mk = monthKey(d);
    let bankFee = 0;
    if (!seenBank.has(mk)) { bankFee += p.monthlyBankFee; seenBank.add(mk); }
    if (i === 0) bankFee += p.bankSetupFee;
    let citadelFee = 0;
    if (p.citadelFee > 0 && !seenCit.has(mk)) { citadelFee = p.citadelFee; seenCit.add(mk); }
    return { date: iso(d), bankFee, citadelFee };
  });
  const bankTotal = fees.reduce((s, f) => s + f.bankFee, 0);
  const citTotal = fees.reduce((s, f) => s + f.citadelFee, 0);
  const total = p.retainerAmount + p.setupFee + bankTotal + citTotal;
  const per = r2(total / count);
  // SF calculateSetupFee: setup fee lands on row 0 (legal plan) or row 1 (else).
  const setupIdx = p.legalPlanRequired ? 0 : Math.min(1, count - 1);
  return allocateSplitSetup(fees.map((f, i) => ({
    ...f,
    setupFee: i === setupIdx ? p.setupFee : 0,
    amount: i === count - 1 ? r2(total - per * (count - 1)) : per,
  })), p.setupFee, setupIdx);
}


/** Allocate setup only from money available in each split; never show negative retainer. */
export function allocateSplitSetup(rows: SplitRow[], setupFee: number, preferredIndex = 0): SplitRow[] {
  const result = rows.map(r => ({ ...r, setupFee: 0 }));
  let remaining = setupFee;
  const indices = [...result.keys()].sort((a, b) => Number(b === preferredIndex) - Number(a === preferredIndex));
  for (const i of indices) {
    const r = result[i];
    r.setupFee = r2(Math.min(remaining, Math.max(0, r.amount - r.bankFee - r.citadelFee)));
    remaining = r2(remaining - r.setupFee);
  }
  return result;
}

export function validateSplit(rows: SplitRow[], retainer: number, setup: number): string | null {
  if (!rows.length) return "Add at least one split payment.";
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0, 10) !== r.date)
      return "Enter a valid date for every payment.";
    if (i && r.date < rows[i - 1].date) return "Keep split payments in date order.";
    if (![r.amount, r.setupFee, r.bankFee, r.citadelFee].every(n => Number.isFinite(n) && n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) < 0.00001) || r.amount <= 0)
      return "Enter positive payment amounts with no more than two decimal places.";
    if (r2(r.setupFee + r.bankFee + r.citadelFee) > r.amount) return "A split payment cannot be less than its fees.";
  }
  const principal = r2(rows.reduce((sum, r) => sum + r.amount - r.bankFee - r.citadelFee, 0));
  if (Math.round(principal * 100) !== Math.round((retainer + setup) * 100)) return `Split payments must cover $${r2(retainer + setup).toFixed(2)} plus the listed bank and Citadel fees.`;
  if (Math.round(rows.reduce((sum, r) => sum + r.setupFee, 0) * 100) !== Math.round(setup * 100)) return "Split payments must include the full setup fee.";
  return null;
}

/** Re-date fees alongside split drafts so changing a month cannot retain stale monthly fees. */
export function updateSplitFees(rows: SplitRow[], params: SplitParams): SplitRow[] {
  const seenBank = new Set<string>();
  const seenCit = new Set<string>(rows.length ? [rows[0].date.slice(0, 7)] : []);
  return rows.map((r, i) => {
    const month = r.date.slice(0, 7);
    const bankFee = (seenBank.has(month) ? 0 : params.monthlyBankFee) + (i === 0 ? params.bankSetupFee : 0);
    const citadelFee = seenCit.has(month) ? 0 : params.citadelFee;
    seenBank.add(month); seenCit.add(month);
    return { ...r, bankFee, citadelFee };
  });
}
