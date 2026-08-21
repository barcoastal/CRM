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
