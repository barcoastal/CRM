import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";

function normalizeKeyFields(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (t) out.push(t);
  }
  return out;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const row = await prisma.pathGuidance.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const before = await prisma.pathGuidance.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.stage !== undefined) {
    const s = String(body.stage).trim();
    if (!s) return NextResponse.json({ error: "stage cannot be empty" }, { status: 400 });
    data.stage = s;
  }
  if (body.keyFields !== undefined) {
    const kf = normalizeKeyFields(body.keyFields);
    if (kf === null) {
      return NextResponse.json({ error: "keyFields must be array of strings" }, { status: 400 });
    }
    data.keyFields = kf as object;
  }
  if (body.guidance !== undefined) {
    data.guidance = body.guidance == null ? null : String(body.guidance);
  }
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (Number.isFinite(n)) data.sortOrder = n;
  }
  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }
  const updated = await prisma.pathGuidance.update({ where: { id }, data });
  await auditWrite({
    userId: r.session.userId,
    entity: "PathGuidance",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const before = await prisma.pathGuidance.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.pathGuidance.delete({ where: { id } });
  await auditWrite({
    userId: r.session.userId,
    entity: "PathGuidance",
    entityId: id,
    action: "DELETE",
    before: before as unknown as Record<string, unknown>,
  });
  return NextResponse.json({ ok: true });
}
