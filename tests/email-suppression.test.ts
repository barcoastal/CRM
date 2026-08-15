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
  it("maps permanent bounces and complaints to reasons", () => {
    expect(decideSuppression("email.bounced", { type: "Permanent" })).toBe("HARD_BOUNCE");
    expect(decideSuppression("email.complained", undefined)).toBe("COMPLAINT");
  });
  it("ignores transient and undetermined bounces and unrelated events", () => {
    expect(decideSuppression("email.bounced", { type: "Transient" })).toBeNull();
    expect(decideSuppression("email.bounced", { type: "Undetermined" })).toBeNull();
    expect(decideSuppression("email.delivered", undefined)).toBeNull();
    expect(decideSuppression("email.opened", undefined)).toBeNull();
  });
  it("treats a bounce without subtype as hard", () => {
    expect(decideSuppression("email.bounced", undefined)).toBe("HARD_BOUNCE");
  });
});
