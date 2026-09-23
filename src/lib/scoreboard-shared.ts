export const SCOREBOARD_TIMEZONE = "America/New_York";
export const SCOREBOARD_POLL_MS = 8_000;
export const CELEBRATION_MS = 8_000;

export interface ScoreboardTarget {
  userId: string;
  debtTarget: number | null;
  contractTarget: number | null;
  firstPaymentDebtTarget: number | null;
}
export interface MonthlyCloser extends ScoreboardTarget {
  name: string;
  tier: number | null;
  transfers: number;
  contractsOut: number;
  signed: number;
  grossDebt: number;
  canceled: number;
  canceledDebt: number;
  netDebt: number;
  won: number;
  paid: number;
  paidDebt: number;
}
export interface ScoreboardPayload {
  period: string;
  generatedAt: string;
  rows: MonthlyCloser[];
  canManage: boolean;
}
export interface WinEvent {
  id: string;
  opportunityId: string;
  closerId: string;
  closerName: string;
  debt: number | null;
  at: string;
  demo?: boolean;
}
export interface WinCursor { at: string; id: string }
export interface WinPayload { events: WinEvent[]; cursor: WinCursor; hasMore: boolean }

export function currentScoreboardPeriod(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SCOREBOARD_TIMEZONE, year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

export function validScoreboardPeriod(period: string): boolean {
  return /^(20\d{2})-(0[1-9]|1[0-2])$/.test(period);
}

/** Resolve Eastern midnight iteratively, including months spanning DST. */
function easternMidnight(year: number, month: number): Date {
  const wanted = Date.UTC(year, month - 1, 1);
  let instant = wanted;
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: SCOREBOARD_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    const correction = wanted - represented;
    instant += correction;
    if (!correction) break;
  }
  return new Date(instant);
}

export function scoreboardMonthRange(period: string): { from: Date; to: Date } {
  if (!validScoreboardPeriod(period)) throw new Error("Choose a valid month.");
  const [year, month] = period.split("-").map(Number);
  return { from: easternMidnight(year, month), to: easternMidnight(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1) };
}

export function targetPercent(actual: number, target: number | null): number | null {
  return target !== null && target > 0 ? actual / target * 100 : null;
}
export function totalScoreboard(rows: MonthlyCloser[]) {
  return rows.reduce((t, row) => ({
    debt: t.debt + row.grossDebt, netDebt: t.netDebt + row.netDebt,
    target: t.target + (row.debtTarget ?? 0), targetCount: t.targetCount + (row.debtTarget !== null && row.debtTarget > 0 ? 1 : 0),
    signed: t.signed + row.signed, won: t.won + row.won, transfers: t.transfers + row.transfers,
    contractsOut: t.contractsOut + row.contractsOut, canceled: t.canceled + row.canceled,
    canceledDebt: t.canceledDebt + row.canceledDebt, paid: t.paid + row.paid, paidDebt: t.paidDebt + row.paidDebt,
  }), { debt: 0, netDebt: 0, target: 0, targetCount: 0, signed: 0, won: 0, transfers: 0, contractsOut: 0, canceled: 0, canceledDebt: 0, paid: 0, paidDebt: 0 });
}

/** Event IDs, rather than changing totals, prevent replays on each refresh. */
export function unseenWins(events: WinEvent[], seen: Set<string>): WinEvent[] {
  const incoming = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id) || incoming.has(event.id)) return false;
    incoming.add(event.id);
    return true;
  }).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}
