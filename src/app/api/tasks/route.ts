import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createTaskSchema } from "@/lib/validations/task";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Task.View");
  if ("response" in r) return r.response;
  const url = new URL(req.url);

  const where: Record<string, unknown> = {};
  for (const key of ["accountId", "opportunityId", "debtId", "programPlanId", "leadId", "contactId", "ownerId", "status", "recordType"] as const) {
    const v = url.searchParams.get(key);
    if (v) where[key] = v;
  }
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);

  const items = await prisma.task.findMany({
    where,
    take: limit,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: {
      owner: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
      opportunity: { select: { id: true, recordType: true } },
      lead: { select: { id: true, businessName: true, contactName: true } },
      contact: { select: { id: true, fullName: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Task.Create");
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const task = await prisma.task.create({
    data: {
      ...d,
      ownerId: d.ownerId ?? r.session.userId,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      reminderAt: d.reminderAt ? new Date(d.reminderAt) : null,
      callbackDate: d.callbackDate ? new Date(d.callbackDate) : null,
    },
  });
  return NextResponse.json(task, { status: 201 });
}
