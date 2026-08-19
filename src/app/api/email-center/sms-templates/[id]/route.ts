/**
 * Single SMS template.
 *   GET    - fetch
 *   PATCH  - update { name?, body?, description?, isActive? }
 *   DELETE - remove
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const tpl = await prisma.smsTemplate.findUnique({ where: { id } });
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tpl);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { name?: string; body?: string; description?: string; isActive?: boolean };
  if (body.name !== undefined && !body.name.trim()) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
  if (body.name?.trim()) {
    const dupe = await prisma.smsTemplate.findFirst({ where: { name: body.name.trim(), NOT: { id } } });
    if (dupe) return NextResponse.json({ error: "A template with that name already exists" }, { status: 409 });
  }
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.body !== undefined) data.body = body.body;
  if (body.description !== undefined) data.description = body.description ? body.description.trim() : null;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  const tpl = await prisma.smsTemplate.update({ where: { id }, data }).catch(() => null);
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tpl);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const tpl = await prisma.smsTemplate.delete({ where: { id } }).catch(() => null);
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
