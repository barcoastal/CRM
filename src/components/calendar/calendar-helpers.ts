/**
 * Pure date helpers + shared types for the SF-style calendar.
 * Kept dependency-free so client + server can share them.
 */

export type CalendarView = "month" | "week" | "day";

export interface CalendarEventRow {
  id: string;
  subject: string;
  status: string;
  recordType: string;
  startAt: string; // ISO
  endAt: string;   // ISO
  location: string | null;
  ownerId: string | null;
  ownerName: string | null;
  related: {
    href: string | null;
    label: string | null;
    kind: "account" | "opportunity" | "lead" | "contact" | "case" | null;
  };
}

export const HOUR_HEIGHT = 44; // px per hour for week/day grids
export const DAY_HOURS = Array.from({ length: 24 }, (_, i) => i);

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

export function startOfWeek(d: Date): Date {
  // Sunday-first to match SF Lightning
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Returns 35 or 42 dates (5 or 6 weeks) covering the month grid, Sunday-first. */
export function monthGridDays(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const last = endOfMonth(anchor);
  const days: Date[] = [];
  let cur = gridStart;
  // Always at least 6 weeks for stable height when month bleeds.
  while (cur <= last || days.length % 7 !== 0 || days.length < 42) {
    days.push(cur);
    cur = addDays(cur, 1);
    if (days.length >= 42) break;
  }
  return days;
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatRangeLabel(view: CalendarView, anchor: Date): string {
  if (view === "month") {
    return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString(undefined, sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} – ${endStr}`;
  }
  return anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/** Range used for prisma where clause. */
export function rangeFor(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === "month") {
    return { from: startOfWeek(startOfMonth(anchor)), to: endOfDay(addDays(startOfWeek(startOfMonth(anchor)), 41)) };
  }
  if (view === "week") {
    const s = startOfWeek(anchor);
    return { from: s, to: endOfDay(addDays(s, 6)) };
  }
  return { from: startOfDay(anchor), to: endOfDay(anchor) };
}

export function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Group events that overlap into columns so they render side-by-side. */
export function layoutColumns<T extends { startMin: number; endMin: number }>(items: T[]): Array<T & { col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: Array<T & { col: number; cols: number }> = [];
  let cluster: Array<T & { col: number; cols: number }> = [];
  let clusterEnd = -Infinity;

  function flush() {
    if (!cluster.length) return;
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) c.cols = cols;
    out.push(...cluster);
    cluster = [];
    clusterEnd = -Infinity;
  }

  for (const it of sorted) {
    if (it.startMin >= clusterEnd) flush();
    // find first free column
    const used = new Set(cluster.filter((c) => c.endMin > it.startMin).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    const enriched = { ...it, col, cols: 1 } as T & { col: number; cols: number };
    cluster.push(enriched);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return out;
}

/** SF-style color per related entity kind, with a sensible default. */
export function chipColors(kind: CalendarEventRow["related"]["kind"]): { bg: string; border: string; text: string } {
  switch (kind) {
    case "opportunity":
      return { bg: "#fef3e8", border: "#fe9339", text: "#7a3e00" };
    case "lead":
      return { bg: "#fff4e5", border: "#ff9a3c", text: "#7a3e00" };
    case "case":
      return { bg: "#fde9e9", border: "#ea001e", text: "#7a0c1a" };
    case "account":
      return { bg: "#e6f3ff", border: "#1589ee", text: "#0b5394" };
    case "contact":
      return { bg: "#e9f3ec", border: "#3ba755", text: "#1f5a2c" };
    default:
      return { bg: "#e6f3ff", border: "#1589ee", text: "#0b5394" };
  }
}
