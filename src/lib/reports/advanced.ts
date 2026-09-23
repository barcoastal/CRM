import { z } from "zod";
export const groupingSchema = z.object({ field: z.string().min(1), interval: z.enum(["value", "day", "month", "quarter", "year"]).default("value") });
export const reportOptionsSchema = z.object({ groups: z.array(groupingSchema).max(3).default([]) });
export type ReportGrouping = z.infer<typeof groupingSchema>;
export type ReportOptions = z.infer<typeof reportOptionsSchema>;
export function groupingValue(value: unknown, interval = "value"): string {
  if (value == null || value === "") return "(blank)";
  if (interval !== "value") {
    const date = new Date(String(value));
    if (!Number.isFinite(date.getTime())) return "(blank)";
    const iso = date.toISOString();
    if (interval === "year") return iso.slice(0, 4);
    if (interval === "quarter") return `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
    return iso.slice(0, interval === "month" ? 7 : 10);
  }
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}
