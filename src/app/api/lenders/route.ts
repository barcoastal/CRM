import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
export const normLenderName = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");

// GET - the full lender directory (used by the Lenders page, intel cards and
// the creditor typeahead). canEdit tells the UI whether to show edit controls.
export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const lenders = await prisma.lender.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ lenders, canEdit: ADMIN_ROLES.includes(r.session.role) });
}

// POST - add a lender (admin roles).
export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "Lender name is required." }, { status: 400 });
  const nameNorm = normLenderName(name);
  const existing = await prisma.lender.findUnique({ where: { nameNorm } });
  if (existing) return NextResponse.json({ error: "This lender already exists." }, { status: 409 });

  const lender = await prisma.lender.create({
    data: {
      name,
      nameNorm,
      aka: typeof b.aka === "string" ? b.aka.slice(0, 300) || null : null,
      plaidFinicity: b.plaidFinicity === true,
      lienRiskLevel: [1, 2, 3].includes(Number(b.lienRiskLevel)) ? Number(b.lienRiskLevel) : null,
      coj: b.coj === true,
      tro: b.tro === true,
      venue: typeof b.venue === "string" ? b.venue.slice(0, 120) || null : null,
      notes: typeof b.notes === "string" ? b.notes.slice(0, 4000) || null : null,
      legal: b.legal === "Victory" || b.legal === "Citadel" ? (b.legal as string) : null,
      source: "MANUAL",
    },
  });
  return NextResponse.json(lender, { status: 201 });
}
