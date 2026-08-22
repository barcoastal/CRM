import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * Floor-manager assignment: match a fronter's qualified lead to a tier closer.
 * POST creates the handoff (the fronter then sees "Transfer to [closer]").
 * GET returns recent handoffs for the assignment console.
 */
const Body = z.object({
  fronterId: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
  debt: z.number().nullable().optional(),
  debtLabel: z.string().nullable().optional(),
  tier: z.number().int().min(1).max(3).nullable().optional(),
  closerId: z.string(),
});

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const b = parsed.data;

  const closer = await prisma.user.findUnique({ where: { id: b.closerId }, select: { name: true } });
  if (!closer) return NextResponse.json({ error: "Closer not found" }, { status: 404 });

  // The on-call agent id may be a Five9 user id (unmapped to a CRM user) - only
  // keep it as the fronter FK when it's a real User.
  let fronterId: string | null = null;
  if (b.fronterId) {
    const f = await prisma.user.findUnique({ where: { id: b.fronterId }, select: { id: true } });
    fronterId = f?.id ?? null;
  }

  const handoff = await prisma.closerHandoff.create({
    data: {
      fronterId,
      leadId: b.leadId ?? null,
      clientName: b.clientName ?? null,
      debt: b.debt ?? null,
      debtLabel: b.debtLabel ?? null,
      tier: b.tier ?? null,
      closerId: b.closerId,
      assignedById: r.session.userId,
      assignedAt: new Date(),
      status: "ASSIGNED",
    },
  });
  return NextResponse.json({ ok: true, id: handoff.id, closerName: closer.name });
}

const Patch = z.object({
  id: z.string(),
  status: z.enum(["ASSIGNED", "CLOSED", "LOST"]),
  closedDebt: z.number().nullable().optional(),
});

/** Update a handoff outcome (mark CLOSED/LOST). Feeds the closed-deal stats. */
export async function PATCH(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { id, status, closedDebt } = parsed.data;

  const existing = await prisma.closerHandoff.findUnique({ where: { id }, select: { debt: true } });
  if (!existing) return NextResponse.json({ error: "Handoff not found" }, { status: 404 });

  await prisma.closerHandoff.update({
    where: { id },
    data: {
      status,
      // On close, default the closed amount to the attempted debt if none given.
      closedDebt: status === "CLOSED" ? (closedDebt ?? existing.debt ?? null) : status === "LOST" ? null : undefined,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const rows = await prisma.closerHandoff.findMany({
    where: { createdAt: { gt: new Date(Date.now() - 12 * 3600 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { closer: { select: { name: true } }, fronter: { select: { name: true } } },
  });
  return NextResponse.json({
    rows: rows.map((h) => ({
      id: h.id,
      createdAt: h.createdAt,
      fronter: h.fronter?.name ?? null,
      closer: h.closer?.name ?? null,
      clientName: h.clientName,
      debtLabel: h.debtLabel,
      tier: h.tier,
      status: h.status,
    })),
  });
}
