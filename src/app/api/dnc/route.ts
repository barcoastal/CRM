/**
 * DNC list endpoints (replaces SF SuppressionListBatch + Five9 DNC sync).
 *
 *   GET  /api/dnc?phone=...     — check if a phone is on the DNC list
 *   GET  /api/dnc               — list entries (paginated)
 *   POST /api/dnc               — add a phone to the DNC list
 *   POST /api/dnc/import        — bulk import a CSV of phone numbers
 *   POST /api/dnc/check         — batch DNC check for a set of phones
 *   DEL  /api/dnc?phone=...     — remove a phone from the DNC list
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { addSuppression, isSuppressed, normalizePhone, removeSuppression } from "@/lib/dnc";

export async function GET(request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Read");
  if ("response" in r) return r.response;

  const url = new URL(request.url);
  const phone = url.searchParams.get("phone");

  if (phone) {
    const blocked = await isSuppressed(phone);
    return NextResponse.json({ phone: normalizePhone(phone), blocked });
  }

  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);
  const reason = url.searchParams.get("reason");
  const items = await prisma.suppressionEntry.findMany({
    where: reason ? { reason } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { addedBy: { select: { name: true } }, lead: { select: { id: true, contactName: true } } },
  });
  const total = await prisma.suppressionEntry.count();
  return NextResponse.json({ items, total });
}

export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const { session } = r;

  const body = await request.json().catch(() => ({}));
  const { phone, reason, source, leadId, notes, expiresAt } = body ?? {};
  if (!phone || typeof phone !== "string") {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }
  try {
    const out = await addSuppression({
      phone,
      reason,
      source,
      leadId: leadId ?? null,
      notes: notes ?? null,
      addedById: session.userId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Add failed" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const phone = new URL(request.url).searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });
  const removed = await removeSuppression(phone);
  return NextResponse.json({ ok: true, removed });
}
