import { describe, it, expect } from "vitest";
import { generateDraftDates } from "../../src/lib/debit-schedule";

const iso = (d: Date) => d.toISOString().substring(0, 10);

describe("generateDraftDates — MONTHLY", () => {
  it("produces one draft per month on the configured day", () => {
    const dates = generateDraftDates(
      { frequency: "MONTHLY", startDate: new Date("2026-02-01"), dayOfMonth: 1 },
      new Date("2026-02-01"),
      new Date("2026-05-31"),
    );
    expect(dates.map(iso)).toEqual([
      "2026-02-02", // Feb 1 is a Sunday → slip to Monday Feb 2
      "2026-03-02",
      "2026-04-01",
      "2026-05-01",
    ]);
  });

  it("clamps dayOfMonth > 28 to 28", () => {
    const dates = generateDraftDates(
      { frequency: "MONTHLY", startDate: new Date("2026-02-01"), dayOfMonth: 31 },
      new Date("2026-02-01"),
      new Date("2026-03-31"),
    );
    expect(dates.map(iso)).toEqual([
      "2026-03-02", // Feb 28 2026 is a Saturday → slip to Mon Mar 2
      "2026-03-30", // Mar 28 is Saturday → slip to Mon Mar 30
    ]);
  });

  it("respects endDate", () => {
    const dates = generateDraftDates(
      {
        frequency: "MONTHLY",
        startDate: new Date("2026-02-01"),
        dayOfMonth: 15,
        endDate: new Date("2026-03-31"),
      },
      new Date("2026-02-01"),
      new Date("2026-12-31"),
    );
    expect(dates.length).toBe(2);
  });
});

describe("generateDraftDates — BIWEEKLY", () => {
  it("repeats every 14 days from startDate", () => {
    const dates = generateDraftDates(
      { frequency: "BIWEEKLY", startDate: new Date("2026-02-02") },
      new Date("2026-02-01"),
      new Date("2026-03-31"),
    );
    expect(dates.map(iso)).toEqual([
      "2026-02-02",
      "2026-02-16",
      "2026-03-02",
      "2026-03-16",
      "2026-03-30",
    ]);
  });
});

describe("generateDraftDates — WEEKLY", () => {
  it("repeats every 7 days from startDate", () => {
    const dates = generateDraftDates(
      { frequency: "WEEKLY", startDate: new Date("2026-02-02") },
      new Date("2026-02-01"),
      new Date("2026-03-01"),
    );
    expect(dates.map(iso)).toEqual(["2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23"]);
  });
});

describe("generateDraftDates — edge cases", () => {
  it("returns empty when endDate is before from", () => {
    const dates = generateDraftDates(
      { frequency: "MONTHLY", startDate: new Date("2026-01-01"), endDate: new Date("2026-01-31") },
      new Date("2026-02-01"),
      new Date("2026-03-31"),
    );
    expect(dates).toEqual([]);
  });

  it("returns empty when startDate is after until", () => {
    const dates = generateDraftDates(
      { frequency: "MONTHLY", startDate: new Date("2027-01-01") },
      new Date("2026-02-01"),
      new Date("2026-03-31"),
    );
    expect(dates).toEqual([]);
  });
});
