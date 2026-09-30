import { describe, expect, it } from "vitest";
import {
  centerNavHref,
  centerPage,
  centerStatus,
  centerStatusWhere,
  centerWhere,
} from "../src/lib/esign/center";
const now = new Date("2026-10-01T00:00:00Z");
describe("e-sign center", () => {
  it("keeps pending and expired recipients separate", () => {
    expect(centerStatusWhere("pending", now)).toEqual({
      status: { in: ["SENT", "VIEWED"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    });
    expect(centerStatusWhere("expired", now)).toEqual({
      status: { in: ["SENT", "VIEWED"] },
      expiresAt: { lte: now },
    });
    expect(centerStatus({ status: "SENT", expiresAt: now }, now)).toBe(
      "Expired",
    );
    expect(centerStatus({ status: "COMPLETED", expiresAt: now }, now)).toBe(
      "Completed",
    );
  });
  it("supports legacy status links and both signature completion states", () => {
    expect(centerStatusWhere("COMPLETED", now)).toEqual({
      status: "COMPLETED",
    });
    expect(centerStatusWhere("signed", now)).toEqual({
      status: { in: ["SIGNED", "COMPLETED"] },
    });
  });
  it("combines search with status and template instead of dropping filters", () => {
    const where = centerWhere(
      { q: " Bar ", status: "pending", templateId: "template-1" },
      now,
    );
    expect(where.AND).toHaveLength(3);
    expect(JSON.stringify(where)).toContain('"contains":"Bar"');
    expect(JSON.stringify(where)).toContain('"templateId":"template-1"');
  });
  it("maps old menu preferences and nested pages into one center", () => {
    for (const path of [
      "/sign-docs",
      "/envelopes",
      "/envelopes/packets/123",
      "/templates/esign/new",
      "/contracts/templates/COASTAL/edit",
    ])
      expect(centerNavHref(path)).toBe("/sign-docs");
    expect(centerNavHref("/email-templates")).toBe("/email-templates");
  });
  it("rejects invalid pagination", () => {
    for (const value of [undefined, "-1", "1.2", "NaN", "Infinity"])
      expect(centerPage(value)).toBe(1);
    expect(centerPage("3")).toBe(3);
  });
});
