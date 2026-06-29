import { describe, it, expect } from "vitest";
import { resolveAgreement, isVictoryCreditor } from "@/lib/creditor-agreements";

describe("creditor -> agreement routing", () => {
  it("a VLP creditor is recognized (case/space insensitive)", () => {
    expect(isVictoryCreditor("Ondeck")).toBe(true);
    expect(isVictoryCreditor("  ondeck ")).toBe(true);
    expect(isVictoryCreditor("Kapitus")).toBe(false); // not on VLP tab
  });

  it("all-VLP file -> Victory", () => {
    expect(resolveAgreement(["Ondeck", "Lendr"])).toBe("Victory");
  });

  it("mixed file -> Citadel (Citadel wins)", () => {
    expect(resolveAgreement(["Ondeck", "Kapitus"])).toBe("Citadel");
  });

  it("all non-VLP file -> Citadel", () => {
    expect(resolveAgreement(["Kapitus", "Fora Financial"])).toBe("Citadel");
  });

  it("no creditors -> Citadel (default)", () => {
    expect(resolveAgreement([])).toBe("Citadel");
    expect(resolveAgreement([null, "", undefined])).toBe("Citadel");
  });
});
