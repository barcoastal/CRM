import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

// PATCH - update lender intel (admin roles).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) {
    data.name = b.name.trim().slice(0, 200);
    data.nameNorm = (data.name as string).toLowerCase().replace(/[^a-z0-9 ]/g, "");
  }
  if ("aka" in b) data.aka = typeof b.aka === "string" ? b.aka.slice(0, 300) || null : null;
  if ("plaidFinicity" in b) data.plaidFinicity = b.plaidFinicity === true;
  if ("lienRiskLevel" in b)
    data.lienRiskLevel = [1, 2, 3].includes(Number(b.lienRiskLevel)) ? Number(b.lienRiskLevel) : null;
  if ("coj" in b) data.coj = b.coj === true;
  if ("tro" in b) data.tro = b.tro === true;
  if ("venue" in b) data.venue = typeof b.venue === "string" ? b.venue.slice(0, 120) || null : null;
  if ("notes" in b) data.notes = typeof b.notes === "string" ? b.notes.slice(0, 4000) || null : null;
  if ("legal" in b)
    data.legal = b.legal === "Victory" || b.legal === "Citadel" ? (b.legal as string) : null;
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const lender = await prisma.lender.update({ where: { id }, data });
    return NextResponse.json(lender);
  } catch {
    return NextResponse.json({ error: "Lender not found or name already taken." }, { status: 400 });
  }
}

// DELETE - remove a lender (admin roles).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.lender.delete({ where: { id } }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
