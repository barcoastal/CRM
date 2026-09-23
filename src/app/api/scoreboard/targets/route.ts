import { z } from "zod";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { validScoreboardPeriod } from "@/lib/scoreboard-shared";

const Amount = z.number().finite().min(0).max(1_000_000_000_000).nullable();
const Body = z.object({
  period: z.string().refine(validScoreboardPeriod, "Choose a valid month."),
  targets: z.array(z.object({
    userId: z.string().min(1), debtTarget: Amount,
    contractTarget: z.number().int().min(0).max(1_000_000).nullable(),
    firstPaymentDebtTarget: Amount,
  })).min(1).max(1000),
}).refine((body) => new Set(body.targets.map((t) => t.userId)).size === body.targets.length, "Each closer must appear once.");

export async function PUT(request: Request) {
  const auth = await requireAuthOrRespond("Setup.Admin");
  if ("response" in auth) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid targets." }, { status: 400 });
  const { period, targets } = parsed.data;
  const active = await prisma.user.count({ where: { id: { in: targets.map((t) => t.userId) }, isActive: true, OR: [{ isCloser: true }, { closerTier: { not: null } }] } });
  if (active !== targets.length) return Response.json({ error: "The closer roster changed. Refresh and try again." }, { status: 409 });
  try {
    await prisma.$transaction(targets.map(({ userId, ...values }) => prisma.closerScoreboardTarget.upsert({
      where: { userId_period: { userId, period } }, create: { userId, period, ...values }, update: values,
    })));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[scoreboard] Targets save failed", error);
    return Response.json({ error: "Targets could not be saved. Please try again." }, { status: 500 });
  }
}
