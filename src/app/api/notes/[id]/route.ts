import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

// PATCH - edit the body of an existing note (a Task of type NOTE). Used by the
// account sticky-note card's "click to edit". Keeps subject in sync (the
// truncated body used in activity lists).
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const b = (await request.json().catch(() => ({}))) as { body?: string };
  const body = (b.body ?? "").trim().slice(0, 10000);
  if (!body) return NextResponse.json({ error: "Note text is required." }, { status: 400 });

  const existing = await prisma.task.findUnique({ where: { id }, select: { id: true, type: true } });
  if (!existing || existing.type !== "NOTE") {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  await prisma.task.update({
    where: { id },
    data: { notes: body, subject: body.length > 80 ? `${body.slice(0, 77)}...` : body },
  });
  return NextResponse.json({ ok: true });
}
