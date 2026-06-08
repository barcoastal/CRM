/**
 * Period string utilities.
 * - Monthly: "YYYY-MM" (e.g. "2026-06")
 * - Quarterly: "YYYY-Qn" (e.g. "2026-Q2")
 */

export type PeriodKind = "month" | "quarter";

export interface ParsedPeriod {
  kind: PeriodKind;
  start: Date;
  endExclusive: Date;
  label: string;
}

export function parsePeriod(period: string): ParsedPeriod {
  const trimmed = (period ?? "").trim();
  // Quarter: YYYY-Qn
  const q = /^(\d{4})-Q([1-4])$/i.exec(trimmed);
  if (q) {
    const year = parseInt(q[1], 10);
    const qn = parseInt(q[2], 10);
    const startMonth = (qn - 1) * 3;
    const start = new Date(Date.UTC(year, startMonth, 1));
    const endExclusive = new Date(Date.UTC(year, startMonth + 3, 1));
    return { kind: "quarter", start, endExclusive, label: `Q${qn} ${year}` };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const start = new Date(Date.UTC(year, month, 1));
    const endExclusive = new Date(Date.UTC(year, month + 1, 1));
    const label = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    return { kind: "month", start, endExclusive, label };
  }
  throw new Error(`Invalid period: ${period}`);
}

export function currentMonthPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function currentQuarterPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${y}-Q${q}`;
}

export function shiftPeriod(period: string, delta: number): string {
  const p = parsePeriod(period);
  if (p.kind === "month") {
    const d = new Date(p.start);
    d.setUTCMonth(d.getUTCMonth() + delta);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  const d = new Date(p.start);
  d.setUTCMonth(d.getUTCMonth() + delta * 3);
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${y}-Q${q}`;
}
