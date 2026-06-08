import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { hash } from "bcryptjs";

// GET  /api/files/[id]/shares — list existing shares
// POST /api/files/[id]/shares — body { expiresAt?, password? }

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const shares = await prisma.contentShareLink.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json(shares);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await ctx.params;

  const doc = await prisma.contentDocument.findUnique({ where: { id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    const d = new Date(body.expiresAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
    }
    expiresAt = d;
  }
  let passwordHash: string | null = null;
  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
    }
    passwordHash = await hash(body.password, 10);
  }

  const share = await prisma.contentShareLink.create({
    data: {
      documentId: id,
      createdById: session.userId,
      expiresAt,
      passwordHash,
    },
  });
  return NextResponse.json(share, { status: 201 });
}
