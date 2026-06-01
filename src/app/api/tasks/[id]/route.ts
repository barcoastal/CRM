import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateTaskSchema } from "@/lib/validations/task";
import { auditWrite } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Task.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      owner: true,
      account: true, opportunity: true, debt: true, programPlan: true,
      lead: true, contact: true, call: true,
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Task.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const before = await prisma.task.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d = parsed.data;
  const data: Record<string, unknown> = { ...d };
  if (d.dueDate !== undefined) data.dueDate = d.dueDate ? new Date(d.dueDate) : null;
  if (d.reminderAt !== undefined) data.reminderAt = d.reminderAt ? new Date(d.reminderAt) : null;
  if (d.callbackDate !== undefined) data.callbackDate = d.callbackDate ? new Date(d.callbackDate) : null;
  if (d.status === "COMPLETED" && before.status !== "COMPLETED") data.completedAt = new Date();

  const task = await prisma.task.update({ where: { id }, data });
  await auditWrite({
    userId: r.session.userId, entity: "Task", entityId: id, action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: task as unknown as Record<string, unknown>,
  }).catch(() => null);
  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Task.Delete");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  await prisma.task.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
