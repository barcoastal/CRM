import { describe, it, expect } from "vitest";
import { normalizeEmail, decideSuppression } from "@/lib/email/suppression";

describe("normalizeEmail", () => {
  it("lowercases and trims, extracts bare address from display form", () => {
    expect(normalizeEmail("  Joe <JOE@X.com> ")).toBe("joe@x.com");
    expect(normalizeEmail("PLAIN@X.COM")).toBe("plain@x.com");
    expect(normalizeEmail("")).toBe("");
  });
});

describe("decideSuppression", () => {
  it("maps Resend bounce and complaint events to reasons", () => {
    expect(decideSuppression("email.bounced", { type: "hard" })).toBe("HARD_BOUNCE");
    expect(decideSuppression("email.complained", undefined)).toBe("COMPLAINT");
  });
  it("ignores soft bounces and unrelated events", () => {
    expect(decideSuppression("email.bounced", { type: "soft" })).toBeNull();
    expect(decideSuppression("email.delivered", undefined)).toBeNull();
    expect(decideSuppression("email.opened", undefined)).toBeNull();
  });
  it("treats a bounce without subtype as hard", () => {
    expect(decideSuppression("email.bounced", undefined)).toBe("HARD_BOUNCE");
  });
});
