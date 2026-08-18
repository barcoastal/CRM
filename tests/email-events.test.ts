import { describe, it, expect } from "vitest";
import { isUniqueEvent } from "@/lib/email/events";

describe("isUniqueEvent", () => {
  it("OPEN is unique only when openedAt was not previously set", () => {
    expect(isUniqueEvent("OPEN", { openedAt: null, firstClickedAt: null })).toBe(true);
    expect(isUniqueEvent("OPEN", { openedAt: new Date(), firstClickedAt: null })).toBe(false);
  });
  it("CLICK is unique only when firstClickedAt was not previously set", () => {
    expect(isUniqueEvent("CLICK", { openedAt: null, firstClickedAt: null })).toBe(true);
    expect(isUniqueEvent("CLICK", { openedAt: null, firstClickedAt: new Date() })).toBe(false);
  });
  it("other event types are always recorded (treated as unique)", () => {
    expect(isUniqueEvent("BOUNCE", { openedAt: null, firstClickedAt: null })).toBe(true);
    expect(isUniqueEvent("DELIVERED", { openedAt: new Date(), firstClickedAt: new Date() })).toBe(true);
  });
});
