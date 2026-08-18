// tests/email-reports.test.ts
import { describe, it, expect } from "vitest";
import { computeRates, bucketByDay, topUrls, type MessageAgg } from "@/lib/email/reports";

const agg: MessageAgg = {
  total: 100,
  delivered: 90,
  uniqueOpens: 45,
  uniqueClicks: 12,
  bounced: 6,
  complained: 1,
  unsubscribed: 2,
  failed: 4,
};

describe("computeRates", () => {
  it("computes rates against the right denominators", () => {
    const r = computeRates(agg);
    expect(r.deliveryRate).toBe(90); // delivered / total
    expect(r.openRate).toBe(50); // uniqueOpens / delivered
    expect(r.clickRate).toBe(13.3); // uniqueClicks / delivered, 1 decimal
    expect(r.clickToOpenRate).toBe(26.7); // uniqueClicks / uniqueOpens
    expect(r.bounceRate).toBe(6); // bounced / total
    expect(r.unsubscribeRate).toBe(2.2); // unsubscribed / delivered
  });
  it("never divides by zero", () => {
    const r = computeRates({ total: 0, delivered: 0, uniqueOpens: 0, uniqueClicks: 0, bounced: 0, complained: 0, unsubscribed: 0, failed: 0 });
    expect(r.deliveryRate).toBe(0);
    expect(r.openRate).toBe(0);
    expect(r.clickToOpenRate).toBe(0);
  });
});

describe("bucketByDay", () => {
  it("counts events per YYYY-MM-DD in UTC", () => {
    const rows = [
      { occurredAt: new Date("2026-08-01T10:00:00Z") },
      { occurredAt: new Date("2026-08-01T23:59:00Z") },
      { occurredAt: new Date("2026-08-02T00:01:00Z") },
    ];
    expect(bucketByDay(rows)).toEqual([
      { day: "2026-08-01", count: 2 },
      { day: "2026-08-02", count: 1 },
    ]);
  });
  it("returns an empty array for no rows", () => {
    expect(bucketByDay([])).toEqual([]);
  });
});

describe("topUrls", () => {
  it("ranks click urls by frequency, descending, capped", () => {
    const rows = [
      { url: "https://a.com" },
      { url: "https://a.com" },
      { url: "https://b.com" },
      { url: null },
    ];
    expect(topUrls(rows, 5)).toEqual([
      { url: "https://a.com", count: 2 },
      { url: "https://b.com", count: 1 },
    ]);
  });
});
