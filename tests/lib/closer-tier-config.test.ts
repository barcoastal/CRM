import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/five9/supervisor-feed", () => ({ supervisorFeed: {} }));
import { closerDebtRange, closerTierConfigSchema } from "@/lib/closer-tier-config";
import { tierForDebt } from "@/lib/closer-tiers";
const config = { tier1Max: 100_000, tier2Max: 250_000 };
const body = { ...config, assignments: [{ userId: "closer-a", tier: 1, isCloser: true }] };

describe("closer eligibility", () => {
  it.each([[0, 3], [99_999.99, 3], [100_000, 2], [249_999.99, 2], [250_000, 1], [1_000_000, 1]])("routes $%s to tier %s at exact boundaries", (debt, tier) => {
    expect(tierForDebt(debt, config)).toBe(tier);
  });
  it("explains exclusive upper bounds and uses updated limits", () => {
    expect(closerDebtRange(1, 80_000, 300_000)).toBe("$300,000 and above");
    expect(closerDebtRange(2, 80_000, 300_000)).toBe("$80,000 to under $300,000");
    expect(closerDebtRange(3, 80_000, 300_000)).toBe("Under $80,000");
    expect(closerDebtRange(null, 80_000, 300_000)).toBe("Assign a tier");
    expect(tierForDebt(90_000, { tier1Max: 80_000, tier2Max: 300_000 })).toBe(2);
  });
  it.each([
    { tier1Max: -1 }, { tier1Max: 1.5 }, { tier1Max: NaN },
    { tier2Max: 100_000 }, { tier2Max: 90_000 }, { tier2Max: Infinity }, { tier2Max: 2_147_483_648 },
    { assignments: [{ userId: "a", tier: 4 }] },
    { assignments: [{ userId: "a", tier: 2, isCloser: false }] },
    { assignments: [{ userId: "a", tier: 1 }, { userId: "a", tier: 2 }] },
  ])("rejects invalid eligibility settings: %j", (change) => {
    expect(closerTierConfigSchema.safeParse({ ...body, ...change }).success).toBe(false);
  });
  it("allows explicit roster removal and legacy clients", () => {
    expect(closerTierConfigSchema.safeParse({ ...body, assignments: [{ userId: "a", tier: null, isCloser: false }] }).success).toBe(true);
    expect(closerTierConfigSchema.safeParse({ ...body, assignments: [{ userId: "a", tier: 2 }] }).success).toBe(true);
  });
});
