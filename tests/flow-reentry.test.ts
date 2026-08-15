import { describe, it, expect } from "vitest";
import { shouldReenter } from "@/lib/flow/reentry";

const now = new Date("2026-08-15T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 864e5);

describe("shouldReenter", () => {
  it("ALWAYS always re-enters", () => {
    expect(shouldReenter("ALWAYS", 30, daysAgo(1), now)).toBe(true);
    expect(shouldReenter("ALWAYS", 30, null, now)).toBe(true);
  });
  it("ONCE only enters when there is no prior run", () => {
    expect(shouldReenter("ONCE", 30, null, now)).toBe(true);
    expect(shouldReenter("ONCE", 30, daysAgo(365), now)).toBe(false);
  });
  it("COOLDOWN enters when the last run is older than the cooldown", () => {
    expect(shouldReenter("COOLDOWN", 30, null, now)).toBe(true);
    expect(shouldReenter("COOLDOWN", 30, daysAgo(31), now)).toBe(true);
    expect(shouldReenter("COOLDOWN", 30, daysAgo(29), now)).toBe(false);
  });
  it("unknown policy behaves like ALWAYS", () => {
    expect(shouldReenter("???", 30, daysAgo(1), now)).toBe(true);
  });
});
