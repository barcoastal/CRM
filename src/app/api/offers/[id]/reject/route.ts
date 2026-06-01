import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Offer.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (offer.status === "ACCEPTED") {
    return NextResponse.json({ error: "Cannot reject an accepted offer" }, { status: 409 });
  }
  const updated = await prisma.offer.update({ where: { id }, data: { status: "REJECTED" } });
  return NextResponse.json(updated);
}
