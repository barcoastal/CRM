import { z } from "zod";
export const reportScheduleSchema = z.object({ frequency: z.enum(["daily", "weekly"]), hourUtc: z.number().int().min(0).max(23), snapshotFormat: z.enum(["link", "csv"]).optional(), weekday: z.number().int().min(0).max(6).default(1) });
export type ReportSchedule = z.infer<typeof reportScheduleSchema>;
export function nextReportRun(schedule: ReportSchedule, now = new Date()): Date {
  const date = new Date(now);
  date.setUTCHours(schedule.hourUtc, 0, 0, 0);
  if (date <= now) date.setUTCDate(date.getUTCDate() + 1);
  if (schedule.frequency === "weekly") date.setUTCDate(date.getUTCDate() + (schedule.weekday - date.getUTCDay() + 7) % 7);
  return date;
}
