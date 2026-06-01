/**
 * Pure helper: given a DebitSchedule configuration, produce the list of Draft
 * scheduled dates from `from` up to and including `until`.
 *
 * Frequencies:
 *   MONTHLY: drafts on `dayOfMonth` each month. dayOfMonth is clamped to [1,28]
 *            so February doesn't surprise anyone.
 *   BIWEEKLY: starts at `startDate`, repeats every 14 days.
 *   WEEKLY: starts at `startDate`, repeats every 7 days.
 *
 * The result is sorted ascending. Weekends (Sat/Sun) for MONTHLY schedules slip
 * to the next Monday — most ACH processors do this. WEEKLY/BIWEEKLY keep their
 * fixed cadence.
 *
 * All date math is done in UTC to avoid timezone bugs across server/CI/local
 * environments. Callers should treat input/output Dates as date-only values.
 */

export type ScheduleFrequency = "MONTHLY" | "BIWEEKLY" | "WEEKLY";

export interface DebitScheduleConfig {
  frequency: ScheduleFrequency;
  startDate: Date;
  endDate?: Date | null;
  dayOfMonth?: number | null;
}

export function generateDraftDates(
  cfg: DebitScheduleConfig,
  from: Date,
  until: Date,
): Date[] {
  if (cfg.endDate && cfg.endDate.getTime() < from.getTime()) return [];
  const stop = cfg.endDate && cfg.endDate.getTime() < until.getTime() ? cfg.endDate : until;
  if (cfg.startDate.getTime() > stop.getTime()) return [];

  if (cfg.frequency === "MONTHLY") return monthlyDates(cfg, from, stop);
  if (cfg.frequency === "BIWEEKLY") return fixedCadenceDates(cfg.startDate, from, stop, 14);
  return fixedCadenceDates(cfg.startDate, from, stop, 7);
}

function monthlyDates(cfg: DebitScheduleConfig, from: Date, stop: Date): Date[] {
  const dayOfMonth = clampDayOfMonth(cfg.dayOfMonth ?? cfg.startDate.getUTCDate());
  const result: Date[] = [];

  // Start at the configured startDate or `from`, whichever is later
  const startMs = Math.max(cfg.startDate.getTime(), from.getTime());
  let year = new Date(startMs).getUTCFullYear();
  let month = new Date(startMs).getUTCMonth();

  // First candidate: this month's draft day if still >= startMs, else next month
  let candidate = utcDate(year, month, dayOfMonth);
  if (candidate.getTime() < startMs) {
    month += 1;
    candidate = utcDate(year, month, dayOfMonth);
  }

  while (candidate.getTime() <= stop.getTime()) {
    if (candidate.getTime() >= cfg.startDate.getTime()) {
      result.push(skipWeekendsUTC(candidate));
    }
    month += 1;
    candidate = utcDate(year, month, dayOfMonth);
  }
  return result;
}

function fixedCadenceDates(start: Date, from: Date, stop: Date, intervalDays: number): Date[] {
  const result: Date[] = [];
  let cursorMs = utcDate(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  while (cursorMs < from.getTime()) cursorMs += intervalDays * dayMs;
  const stopMs = stop.getTime();
  while (cursorMs <= stopMs) {
    result.push(new Date(cursorMs));
    cursorMs += intervalDays * dayMs;
  }
  return result;
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  // setUTCMonth handles overflow (month=12 → next year), and setUTCDate clamps
  // to the last day when day exceeds month length (e.g. Feb 31 → Mar 3).
  // We avoid that here because dayOfMonth is clamped to 28.
  return new Date(Date.UTC(year, monthIndex, day));
}

function clampDayOfMonth(d: number): number {
  if (d < 1) return 1;
  if (d > 28) return 28;
  return d;
}

function skipWeekendsUTC(d: Date): Date {
  const day = d.getUTCDay();
  if (day === 0) return new Date(d.getTime() + 24 * 60 * 60 * 1000); // Sunday → Monday
  if (day === 6) return new Date(d.getTime() + 2 * 24 * 60 * 60 * 1000); // Saturday → Monday
  return d;
}
