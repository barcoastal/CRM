import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/closer-tiers - save the debt cutoffs + per-closer tier assignments.
 * Gated on Setup.Admin (the Closer Tiers setup page).
 */
const Body = z.object({
  tier1Max: z.number().int().min(0),
  tier2Max: z.number().int().min(0),
  assignments: z.array(
    z.object({ userId: z.string(), tier: z.number().int().min(1).max(3).nullable() }),
  ),
});

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Setup.Admin");
  if ("response" in r) return r.response;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const { tier1Max, tier2Max, assignments } = parsed.data;
  if (tier2Max <= tier1Max) {
    return NextResponse.json({ error: "Tier 2 cutoff must be greater than Tier 1 cutoff." }, { status: 400 });
  }

  await prisma.closerTierConfig.upsert({
    where: { id: "singleton" },
    update: { tier1Max, tier2Max },
    create: { id: "singleton", tier1Max, tier2Max },
  });

  // Apply tier assignments; setting a tier also marks the user a closer.
  await prisma.$transaction(
    assignments.map((a) =>
      prisma.user.update({
        where: { id: a.userId },
        data: { closerTier: a.tier, ...(a.tier != null ? { isCloser: true } : {}) },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
