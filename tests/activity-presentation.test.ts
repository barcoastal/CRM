import { describe, expect, it } from "vitest";
import { formatActivityDate, importedCallSubject, taskActivity } from "@/lib/activity-presentation";

const base = {
  id: "task", sfId: "00T-imported", subject: "Call-ANSWERING MACHINE_VM-09/23/2026 11:16am EDT",
  type: "CALL", recordType: "ACTIVITY", status: "COMPLETED",
  dueDate: new Date("2026-09-22T21:00:00Z"), completedAt: new Date("2026-09-23T12:16:30Z"),
  createdAt: new Date("2026-09-23T12:16:32Z"),
};

describe("historical call presentation", () => {
  it("uses the explicit call timestamp instead of the imported due date and removes the duplicate suffix", () => {
    expect(taskActivity(base)).toMatchObject({ subject: "Call-ANSWERING MACHINE_VM", date: new Date("2026-09-23T15:16:00Z"), type: "CALL" });
    expect(formatActivityDate(taskActivity(base).date)).toBe("9/23/2026, 11:16 AM EDT");
  });
  it.each([
    ["Call-NO_ANSWER-2026-09-23 11:16 AM", "2026-09-23T15:16:00Z"],
    ["Call-NO_ANSWER-2026-01-23 4:41 PM", "2026-01-23T21:41:00Z"],
    ["Call-NO_ANSWER-01/23/2026 12:00am EST", "2026-01-23T05:00:00Z"],
    ["Call-NO_ANSWER-09/23/2026 12:00pm EDT", "2026-09-23T16:00:00Z"],
  ])("parses %s with Eastern daylight saving", (subject, iso) => {
    expect(importedCallSubject(subject)?.date).toEqual(new Date(iso));
  });
  it.each(["Call-02/30/2026 12:00pm EST", "Call-2026-03-08 2:30 AM", "Call-09/23/2026 25:16am EDT", "Discuss 09/23/2026 11:16am EDT"])("preserves unrecognized or invalid subjects: %s", subject => {
    expect(importedCallSubject(subject)).toBeNull();
    expect(taskActivity({ ...base, subject }).subject).toBe(subject);
  });
  it("does not parse subjects of uncompleted or native scheduled tasks", () => {
    expect(taskActivity({ ...base, status: "NOT_STARTED" })).toMatchObject({ date: base.dueDate, subject: base.subject, done: false });
    expect(taskActivity({ ...base, sfId: null })).toMatchObject({ date: base.completedAt, subject: base.subject });
  });
});

describe("tasks and notifications", () => {
  it("labels completed disposition records and stage updates as notifications", () => {
    expect(taskActivity({ ...base, type: "TASK", recordType: "DISPOSITION", subject: "Archived: Stopped Answering" }).type).toBe("NOTIFICATION");
    expect(taskActivity({ ...base, type: "TASK", subject: "Stage Changed to Closed Lost" }).type).toBe("NOTIFICATION");
  });
  it("keeps checklist actions as tasks and respects due dates for outstanding work", () => {
    expect(taskActivity({ ...base, type: "TASK", recordType: "CHECKLIST", subject: "Send cancellation email" })).toMatchObject({ type: "TASK", date: base.completedAt });
    expect(taskActivity({ ...base, type: "TASK", status: "NOT_STARTED", subject: "Call client tomorrow" })).toMatchObject({ type: "TASK", date: base.dueDate });
  });
  it("preserves imported email and note types instead of relabeling everything TASK", () => {
    expect(taskActivity({ ...base, type: "EMAIL" }).type).toBe("EMAIL");
    expect(taskActivity({ ...base, type: "NOTE" }).type).toBe("NOTE");
    expect(taskActivity({ ...base, type: "CALL", subject: "Logged call", completedAt: null }).date).toBe(base.createdAt);
  });
});
