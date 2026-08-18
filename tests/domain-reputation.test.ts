// tests/domain-reputation.test.ts
import { describe, it, expect } from "vitest";
import { healthScore, grade } from "@/lib/email/domain-reputation";

describe("healthScore", () => {
  it("is 100 for perfect auth, zero bounces/complaints, healthy opens", () => {
    expect(healthScore({
      spf: "PASS", dkim: "PASS", dmarc: "PASS",
      bounceRate: 0, complaintRate: 0, openRate: 40, blacklisted: 0,
    })).toBe(100);
  });
  it("penalizes failed auth, high bounce/complaint, and blacklisting", () => {
    const s = healthScore({
      spf: "FAIL", dkim: "PASS", dmarc: "FAIL",
      bounceRate: 8, complaintRate: 0.5, openRate: 5, blacklisted: 1,
    });
    expect(s).toBeLessThan(50);
    expect(s).toBeGreaterThanOrEqual(0);
  });
  it("clamps to the 0-100 range", () => {
    expect(healthScore({ spf: "FAIL", dkim: "FAIL", dmarc: "FAIL", bounceRate: 100, complaintRate: 100, openRate: 0, blacklisted: 5 })).toBe(0);
  });
});

describe("grade", () => {
  it("labels score bands", () => {
    expect(grade(95)).toBe("Excellent");
    expect(grade(80)).toBe("Good");
    expect(grade(60)).toBe("Fair");
    expect(grade(30)).toBe("Poor");
  });
});
