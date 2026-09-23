import { z } from "zod";

export const closerTierConfigSchema = z.object({
  tier1Max: z.number().int().min(0).max(2_147_483_647),
  tier2Max: z.number().int().min(0).max(2_147_483_647),
  assignments: z.array(z.object({
    userId: z.string().min(1),
    tier: z.number().int().min(1).max(3).nullable(),
    isCloser: z.boolean().optional(),
  })).max(1000),
}).superRefine((value, ctx) => {
  if (value.tier2Max <= value.tier1Max) {
    ctx.addIssue({ code: "custom", path: ["tier2Max"], message: "The Tier 1 minimum must be greater than the Tier 2 minimum." });
  }
  if (new Set(value.assignments.map((a) => a.userId)).size !== value.assignments.length) {
    ctx.addIssue({ code: "custom", path: ["assignments"], message: "Each closer can only be assigned once." });
  }
  for (const [index, assignment] of value.assignments.entries()) {
    if (assignment.isCloser === false && assignment.tier !== null) {
      ctx.addIssue({ code: "custom", path: ["assignments", index], message: "Remove the tier when removing a closer." });
    }
  }
});

/** Upper bounds are exclusive, matching tierForDebt's routing boundaries. */
export function closerDebtRange(tier: number | null, small: number, large: number): string {
  const money = (n: number) => `$${n.toLocaleString("en-US")}`;
  if (!Number.isFinite(small) || !Number.isFinite(large) || small < 0 || large <= small) return "Set valid debt limits";
  if (tier === 1) return `${money(large)} and above`;
  if (tier === 2) return `${money(small)} to under ${money(large)}`;
  if (tier === 3) return `Under ${money(small)}`;
  return "Assign a tier";
}
