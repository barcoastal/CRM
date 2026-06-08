import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";

export async function GET(req: Request) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") || undefined;
  const period = url.searchParams.get("period") || undefined;

  const quotas = await prisma.quota.findMany({
    where: {
      ...(userId ? { userId } : {}),
      ...(period ? { period } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ period: "desc" }, { userId: "asc" }],
  });

  return NextResponse.json({
    quotas: quotas.map((q) => ({
      id: q.id,
      userId: q.userId,
      userName: q.user.name,
      period: q.period,
      amount: Number(q.amount),
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    })),
  });
}

export async function POST(req: Request) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  let body: { userId?: string; period?: string; amount?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, period } = body;
  const amountNum =
    typeof body.amount === "string" ? parseFloat(body.amount) : Number(body.amount ?? NaN);

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (!period || !/^\d{4}-(Q[1-4]|\d{2})$/i.test(period)) {
    return NextResponse.json({ error: "period must be YYYY-MM or YYYY-Qn" }, { status: 400 });
  }
  if (!Number.isFinite(amountNum) || amountNum < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }

  const existing = await prisma.quota.findUnique({
    where: { userId_period: { userId, period } },
  });

  const quota = await prisma.quota.upsert({
    where: { userId_period: { userId, period } },
    create: { userId, period, amount: amountNum },
    update: { amount: amountNum },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "Quota",
    entityId: quota.id,
    action: existing ? "UPDATE" : "CREATE",
    before: existing ? { amount: Number(existing.amount) } : null,
    after: { amount: Number(quota.amount), period, userId },
  });

  return NextResponse.json({
    ok: true,
    quota: {
      id: quota.id,
      userId: quota.userId,
      period: quota.period,
      amount: Number(quota.amount),
    },
  });
}
