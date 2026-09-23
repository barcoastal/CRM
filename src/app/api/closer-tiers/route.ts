import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { closerTierConfigSchema } from "@/lib/closer-tier-config";

/**
 * POST /api/closer-tiers - save the debt cutoffs + per-closer tier assignments.
 * Gated on Setup.Admin (the Closer Tiers setup page).
 */
export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Setup.Admin");
  if ("response" in r) return r.response;

  const parsed = closerTierConfigSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid closer setup", details: parsed.error.flatten() }, { status: 400 });
  }
  const { tier1Max, tier2Max, assignments } = parsed.data;
  try {
    // Save limits and roster together. A missing/deactivated user must not
    // leave the routing limits changed while the roster fails to save.
    await prisma.$transaction([
      prisma.closerTierConfig.upsert({
        where: { id: "singleton" },
        update: { tier1Max, tier2Max },
        create: { id: "singleton", tier1Max, tier2Max },
      }),
      ...assignments.map((a) => prisma.user.update({
        where: { id: a.userId, isActive: true },
        data: {
          closerTier: a.tier,
          // Old clients omit isCloser. Preserve their no-tier behavior;
          // explicit roster removal disables the closer flag as well.
          ...(a.tier !== null ? { isCloser: true } : a.isCloser !== undefined ? { isCloser: a.isCloser } : {}),
        },
      })),
    ]);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "A selected user is no longer active or available. Refresh the page and try again." }, { status: 409 });
    }
    console.error("[closer-tiers] Save failed", error);
    return NextResponse.json({ error: "Could not save closer setup. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
