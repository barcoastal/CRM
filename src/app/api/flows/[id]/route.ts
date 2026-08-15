/**
 * Flow Builder single-flow API.
 *   GET    /api/flows/:id
 *   PATCH  /api/flows/:id  { name?, description?, isActive?, entryCriteria?, graph?, ... }
 *   DELETE /api/flows/:id
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { SUPPORTED_ENTITIES, TRIGGER_EVENTS } from "@/lib/flow/nodes";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const flow = await prisma.flow.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { runs: true } },
    },
  });
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ flow });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.flow.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (typeof body?.name === "string") patch.name = body.name.trim();
  if (body?.description !== undefined) patch.description = body.description == null ? null : String(body.description);
  if (body?.isActive !== undefined) patch.isActive = body.isActive !== false;
  if (typeof body?.entityType === "string") {
    if (!(SUPPORTED_ENTITIES as readonly string[]).includes(body.entityType)) {
      return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
    }
    patch.entityType = body.entityType;
  }
  if (typeof body?.triggerEvent === "string") {
    if (!(TRIGGER_EVENTS as readonly string[]).includes(body.triggerEvent)) {
      return NextResponse.json({ error: "Invalid triggerEvent" }, { status: 400 });
    }
    patch.triggerEvent = body.triggerEvent;
  }
  if (body?.entryCriteria !== undefined) {
    patch.entryCriteria = body.entryCriteria as object;
  }
  if (body?.triggerOnFieldChanges !== undefined) {
    const arr = Array.isArray(body.triggerOnFieldChanges)
      ? (body.triggerOnFieldChanges as unknown[]).filter((s) => typeof s === "string")
      : [];
    patch.triggerOnFieldChanges = arr as object;
  }
  if (body?.graph !== undefined) {
    patch.graph = body.graph as object;
  }

  // Inactivity + re-entry fields
  const REENTRY_POLICIES = ["ALWAYS", "ONCE", "COOLDOWN"] as const;
  if (typeof body?.reentryPolicy === "string") {
    if (!(REENTRY_POLICIES as readonly string[]).includes(body.reentryPolicy)) {
      return NextResponse.json({ error: "Invalid reentryPolicy" }, { status: 400 });
    }
    patch.reentryPolicy = body.reentryPolicy;
  }
  if (body?.reentryCooldownDays !== undefined) {
    const v = Number(body.reentryCooldownDays);
    if (!Number.isFinite(v) || v < 1 || v > 3650) {
      return NextResponse.json({ error: "reentryCooldownDays must be 1-3650" }, { status: 400 });
    }
    patch.reentryCooldownDays = Math.round(v);
  }
  if ("inactivityDays" in body) {
    if (body.inactivityDays == null) {
      patch.inactivityDays = null;
    } else {
      const v = Number(body.inactivityDays);
      if (!Number.isFinite(v) || v < 1 || v > 3650) {
        return NextResponse.json({ error: "inactivityDays must be 1-3650" }, { status: 400 });
      }
      patch.inactivityDays = Math.round(v);
    }
  }

  const flow = await prisma.flow.update({ where: { id }, data: patch });
  await auditWrite({
    userId: r.session.userId,
    entity: "Flow",
    entityId: id,
    action: "UPDATE",
    before: existing as unknown as Record<string, unknown>,
    after: patch,
  });
  return NextResponse.json({ flow });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const existing = await prisma.flow.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.flow.delete({ where: { id } });
  await auditWrite({
    userId: r.session.userId,
    entity: "Flow",
    entityId: id,
    action: "DELETE",
    before: { name: existing.name, entityType: existing.entityType },
  });
  return NextResponse.json({ ok: true });
}
