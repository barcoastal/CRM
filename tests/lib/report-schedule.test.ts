import { expect, it } from "vitest";
import { nextReportRun, reportScheduleSchema } from "@/lib/reports/schedule";
it("schedules daily reminders at the next UTC hour, including month rollover", () => {
  expect(nextReportRun({ frequency: "daily", hourUtc: 9, weekday: 1 }, new Date("2026-09-30T09:00:00Z")).toISOString()).toBe("2026-10-01T09:00:00.000Z");
  expect(nextReportRun({ frequency: "daily", hourUtc: 9, weekday: 1 }, new Date("2026-09-30T08:59:00Z")).toISOString()).toBe("2026-09-30T09:00:00.000Z");
});
it("schedules weekly reminders strictly after now", () => {
  expect(nextReportRun({ frequency: "weekly", hourUtc: 9, weekday: 1 }, new Date("2026-09-28T09:00:00Z")).toISOString()).toBe("2026-10-05T09:00:00.000Z");
});
it("rejects invalid schedules", () => {
  expect(reportScheduleSchema.safeParse({ frequency: "hourly", hourUtc: 25, weekday: 8 }).success).toBe(false);
});
