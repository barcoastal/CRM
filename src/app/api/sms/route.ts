import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createSmsSchema } from "@/lib/validations/sms-message";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("SMS.Send");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const where: Record<string, unknown> = {};
  for (const key of ["accountId", "contactId", "leadId", "caseId", "ownerId", "status", "direction"] as const) {
    const v = url.searchParams.get(key);
    if (v) where[key] = v;
  }
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
  const items = await prisma.smsMessage.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("SMS.Send");
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = createSmsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const msg = await prisma.smsMessage.create({
    data: { ...d, ownerId: d.ownerId ?? r.session.userId },
  });
  return NextResponse.json(msg, { status: 201 });
}
