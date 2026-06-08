import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

// PATCH /api/files/[id]/shares/[shareId] — revoke / update expiry
// DELETE — hard delete
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; shareId: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { shareId, id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.isRevoked === "boolean") data.isRevoked = body.isRevoked;
  if (body.expiresAt === null) data.expiresAt = null;
  else if (typeof body.expiresAt === "string") {
    const d = new Date(body.expiresAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
    }
    data.expiresAt = d;
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const updated = await prisma.contentShareLink.updateMany({
    where: { id: shareId, documentId: id },
    data,
  });
  if (!updated.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const share = await prisma.contentShareLink.findUnique({ where: { id: shareId } });
  return NextResponse.json(share);
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; shareId: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { shareId, id } = await ctx.params;
  const res = await prisma.contentShareLink.deleteMany({
    where: { id: shareId, documentId: id },
  });
  if (!res.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
