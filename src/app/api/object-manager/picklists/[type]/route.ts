import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Thin wrapper over the existing Disposition table so the Object Manager UI
 * can render and edit picklist values per entity. The route param `type` is
 * the entity name (Lead, Opportunity, Task, Call, etc.). Callers can filter
 * by category via ?category=SUB_DISPOSITION.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { type } = await params;
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const items = await prisma.disposition.findMany({
    where: {
      entity: type,
      ...(category ? { category } : {}),
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { type } = await params;

  const body = await req.json().catch(() => ({}));
  const category = String(body?.category ?? "").trim();
  const value = String(body?.value ?? "").trim();
  const label = String(body?.label ?? "").trim() || value;
  const sortOrder = Number.isFinite(body?.sortOrder) ? Number(body.sortOrder) : 0;
  const isActive = body?.isActive !== false;
  const stage = body?.stage ? String(body.stage) : null;
  const leadStatusMapping = body?.leadStatusMapping
    ? String(body.leadStatusMapping)
    : null;

  if (!category || !value) {
    return NextResponse.json(
      { error: "category and value are required" },
      { status: 400 },
    );
  }

  const created = await prisma.disposition.create({
    data: {
      entity: type,
      category,
      value,
      label,
      sortOrder,
      isActive,
      stage,
      leadStatusMapping,
    },
  });

  await auditWrite({
    userId: r.session.userId,
    entity: "Disposition",
    entityId: created.id,
    action: "CREATE",
    after: created as unknown as Record<string, unknown>,
  });

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { type } = await params;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }
  const existing = await prisma.disposition.findUnique({ where: { id } });
  if (!existing || existing.entity !== type) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.disposition.delete({ where: { id } });
  await auditWrite({
    userId: r.session.userId,
    entity: "Disposition",
    entityId: id,
    action: "DELETE",
    before: existing as unknown as Record<string, unknown>,
  });
  return NextResponse.json({ ok: true });
}
