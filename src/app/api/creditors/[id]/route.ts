import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateCreditorSchema } from "@/lib/validations/creditor";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Account.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const creditor = await prisma.creditor.findUnique({
    where: { id },
    include: { account: true, debts: { take: 50, orderBy: { createdAt: "desc" } } },
  });
  if (!creditor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(creditor);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateCreditorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const creditor = await prisma.creditor.update({ where: { id }, data: parsed.data });
  return NextResponse.json(creditor);
}
