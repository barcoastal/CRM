import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const Body = z.object({
  outcome: z.string().optional().nullable(),
  disposition: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Task.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const before = await prisma.task.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (before.status === "COMPLETED") {
    return NextResponse.json({ ok: true, alreadyCompleted: true, task: before });
  }
  const task = await prisma.task.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      outcome: d.outcome ?? before.outcome,
      disposition: d.disposition ?? before.disposition,
      notes: d.notes ?? before.notes,
    },
  });
  return NextResponse.json({ ok: true, task });
}
