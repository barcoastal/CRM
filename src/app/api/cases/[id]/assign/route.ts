import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { assignCaseSchema } from "@/lib/validations/case";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Case.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = assignCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  // When assigning to a user, clear the group, and vice-versa
  const data: Record<string, unknown> = {};
  if (d.ownerId !== undefined) {
    data.ownerId = d.ownerId;
    if (d.ownerId) data.ownerGroupId = null;
  }
  if (d.ownerGroupId !== undefined) {
    data.ownerGroupId = d.ownerGroupId;
    if (d.ownerGroupId) data.ownerId = null;
  }
  const updated = await prisma.case.update({ where: { id }, data });
  return NextResponse.json(updated);
}
