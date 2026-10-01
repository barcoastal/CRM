import type { RescheduleResult, RescheduleRow } from "@/lib/reschedule-schedule";
import type { CalculatorState } from "./calculator-state";
import { validateSplit } from "./retainer-split";
import { splitDraft, MAX_DRAFT_AMOUNT } from "./draft-engine";

export type DisplayRow = RescheduleRow & { _child?: boolean; _summary?: boolean; _tenkPart?: number; _tenkOf?: number };
const round2 = (n: number) => Math.round(n * 100) / 100;

/** One projection for the calculator, saved summary and client quote. Summary and
 * skipped rows stay visible in the editor but are never counted as payments. */
export function projectCalculation(result: RescheduleResult, state: Pick<CalculatorState, "splitRows" | "moveDrafts" | "skipped" | "rowEdits" | "extraRows"> & { weeklyPaymentDay?: string }, editingRow: number | null = null): DisplayRow[] {
  const { splitRows, rowEdits } = state;
  const skipped = new Set(state.skipped);
  const extraRows = state.extraRows.map(r => ({ ...r, date: new Date(r.date), status: r.status as RescheduleRow["status"] }));
  const t = result.totals;
  const displayRows: DisplayRow[] = (() => {
    if (!splitRows || splitRows.length === 0) return result.rows.map(r => ({ ...r }));
    const total = round2(splitRows.reduce((s, r) => s + r.amount, 0));
    const bankT = round2(splitRows.reduce((s, r) => s + r.bankFee, 0));
    const citT = round2(splitRows.reduce((s, r) => s + r.citadelFee, 0));
    const parent: DisplayRow = {
      _summary: true, index: 1, date: new Date(splitRows[0].date), weeklyDraftAmount: total,
      programFee: 0, retainerFee: t.retainerAmount, setupFee: t.setupFee,
      bankFee: bankT, serviceFee: 0, citadelFee: citT, escrowAmount: 0,
      runningBalance: 0, status: "Pending",
    };
    let run = 0;
    const children: DisplayRow[] = splitRows.map((s, i) => {
      run = round2(run + s.amount);
      return {
        index: i + 2, date: new Date(s.date), weeklyDraftAmount: s.amount, programFee: 0,
        retainerFee: round2(s.amount - s.bankFee - s.setupFee - s.citadelFee),
        setupFee: s.setupFee, bankFee: s.bankFee, serviceFee: 0, citadelFee: s.citadelFee,
        escrowAmount: 0, runningBalance: run, status: "Pending", _child: true,
      };
    });
    const lastSplit = new Date(splitRows[splitRows.length - 1].date);
    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(state.weeklyPaymentDay ?? "Friday");
    const reDated: DisplayRow[] = result.rows.slice(1).map((r, i) => {
      const d = new Date(lastSplit);
      d.setUTCDate(d.getUTCDate() + 7 * (i + 1));
      d.setUTCDate(d.getUTCDate() - d.getUTCDay() + weekday);
      return { ...r, index: 1 + children.length + i + 1, date: state.moveDrafts === false ? r.date : d };
    });
    return [parent, ...children, ...reDated];
  })();
  const finalRows: DisplayRow[] = (() => {
    const combined: DisplayRow[] = [];
    const seen = new Set<number>();
    function insert(r: DisplayRow) {
      if (seen.has(r.index)) return;
      seen.add(r.index); combined.push(r);
      extraRows.filter(x => x._after === r.index).forEach(insert);
    }
    displayRows.forEach(insert);
    const rows = combined.map((r) => {
      const e = rowEdits[r.index];
      return e ? { ...r, date: Number.isFinite(Date.parse(e.date)) ? new Date(e.date) : r.date, weeklyDraftAmount: e.amount, escrowAmount: round2(r.escrowAmount + e.amount - r.weeklyDraftAmount) } : r;
    });
    // Skipping a payment DEFERS it: the program still collects the full amount,
    // so each skipped draft is re-added at the end (program extends by one week).
    const deferred = rows.filter((r) => skipped.has(r.index) && r.index !== 1);
    if (deferred.length && rows.length) {
      let d = new Date(Math.max(...rows.map(r => r.date.getTime())));
      deferred.forEach((r, i) => {
        d = new Date(d);
        d.setUTCDate(d.getUTCDate() + 7);
        rows.push({ ...r, index: -5000 - i, date: new Date(d), status: "Pending", _child: false, runningBalance: 0 });
      });
    }
    return rows;
  })();
  const expanded: DisplayRow[] = (() => {
    const out: DisplayRow[] = [];
    for (const r of finalRows) {
      if (r._summary || !Number.isFinite(r.weeklyDraftAmount) || r.weeklyDraftAmount <= MAX_DRAFT_AMOUNT || skipped.has(r.index) || editingRow === r.index) {
        out.push(r);
        continue;
      }
      const kids = splitDraft(
        {
          date: r.date,
          amount: r.weeklyDraftAmount,
          feeRetainer: r.retainerFee,
          feeProgram: r.programFee,
          feeSetup: r.setupFee,
          feeService: r.serviceFee,
          feeBank: r.bankFee,
          feeLegal: r.citadelFee,
          escrowAmount: r.escrowAmount,
        },
        `tenk-${r.index}`,
      );
      kids.forEach((k, i) => {
        out.push({
          ...r,
          date: k.date,
          weeklyDraftAmount: k.amount,
          retainerFee: k.feeRetainer,
          programFee: k.feeProgram,
          setupFee: k.feeSetup,
          serviceFee: k.feeService,
          bankFee: k.feeBank,
          citadelFee: k.feeLegal,
          escrowAmount: k.escrowAmount,
          _tenkPart: i + 1,
          _tenkOf: kids.length,
        });
      });
    }
    return out;
  })();
  let balance = 0;
  return expanded.map(r => {
    if (!r._summary && !skipped.has(r.index)) balance = round2(balance + r.escrowAmount);
    return { ...r, runningBalance: balance };
  });
}

export function collectibleRows(rows: DisplayRow[], skipped: number[] = []): DisplayRow[] {
  return rows.filter(r => !r._summary && !skipped.includes(r.index));
}

/** Validate edits before persisting a financial projection. */
export function calculationError(result: RescheduleResult, state: CalculatorState): string | null {
  if (state.splitRows) {
    const error = validateSplit(state.splitRows, result.totals.retainerAmount, result.totals.setupFee);
    if (error) return error;
  }
  const rows = projectCalculation(result, state);
  for (const [key, edit] of Object.entries(state.rowEdits)) {
    const index = Number(key);
    const row = projectCalculation(result, state, index).find(r => r.index === index);
    if (!row || row._summary || row._child || index === 1) return "A payment edit no longer matches the calculation. Reset the row edits before saving.";
    if (row.escrowAmount < 0) return "An edited payment cannot be less than its allocated fees.";
    if (Math.abs(edit.amount * 100 - Math.round(edit.amount * 100)) > 0.00001) return "Payment amounts can have at most two decimal places.";
  }
  for (const index of state.skipped) {
    if (index === 1 || index <= -5000 || !rows.some(r => r.index === index)) return "A skipped payment no longer matches the calculation.";
  }
  if (new Set(state.extraRows.map(r => r.index)).size !== state.extraRows.length || state.extraRows.some(r => r.index >= 0 || r.index <= -5000 || !rows.some(p => p.index === r.index)))
    return "An added payment no longer matches the calculation.";
  for (const row of state.extraRows) {
    const allocated = row.programFee + row.retainerFee + row.setupFee + row.bankFee + row.serviceFee + row.citadelFee + row.escrowAmount;
    if (row.weeklyDraftAmount <= 0 || Math.abs(round2(allocated) - row.weeklyDraftAmount) > 0.01) return "An added payment must equal its fees plus escrow allocation.";
  }
  return null;
}
