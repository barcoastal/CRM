import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { isWithinCallingWindow } from "@/lib/ai-dialer/compliance";
import { verifyRetellWebhook } from "@/lib/ai-dialer/retell";

describe("AI dialer compliance", () => {
  it("allows a call inside the lead's local window", () => {
    expect(isWithinCallingWindow({
      state: "NY", campaignTimezone: "America/New_York",
      startTime: "08:00", endTime: "20:00",
      now: new Date("2026-08-30T16:00:00.000Z"),
    })).toBe(true);
  });

  it("blocks a multi-zone state if any applicable zone is too early", () => {
    expect(isWithinCallingWindow({
      state: "FL", campaignTimezone: "America/New_York",
      startTime: "08:00", endTime: "20:00",
      now: new Date("2026-08-30T12:30:00.000Z"),
    })).toBe(false);
  });

  it("never expands a campaign beyond the federal 8am-9pm window", () => {
    expect(isWithinCallingWindow({
      state: "CA", campaignTimezone: "America/Los_Angeles",
      startTime: "06:00", endTime: "23:00",
      now: new Date("2026-08-30T14:30:00.000Z"),
    })).toBe(false);
  });
});

describe("Retell webhook verification", () => {
  const original = process.env.RETELL_API_KEY;
  afterEach(() => { process.env.RETELL_API_KEY = original; });

  it("accepts a current valid HMAC and rejects a modified body", () => {
    process.env.RETELL_API_KEY = "test-retell-key";
    const body = JSON.stringify({ event: "call_ended", call: { call_id: "call_1" } });
    const timestamp = Date.now().toString();
    const digest = crypto.createHmac("sha256", "test-retell-key").update(body + timestamp).digest("hex");
    const signature = `v=${timestamp},d=${digest}`;
    expect(verifyRetellWebhook(body, signature)).toBe(true);
    expect(verifyRetellWebhook(`${body} `, signature)).toBe(false);
  });

  it("rejects replayed signatures", () => {
    process.env.RETELL_API_KEY = "test-retell-key";
    const body = "{}";
    const timestamp = (Date.now() - 6 * 60_000).toString();
    const digest = crypto.createHmac("sha256", "test-retell-key").update(body + timestamp).digest("hex");
    expect(verifyRetellWebhook(body, `v=${timestamp},d=${digest}`)).toBe(false);
  });
});
