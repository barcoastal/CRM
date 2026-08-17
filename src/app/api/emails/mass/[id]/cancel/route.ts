/** POST: cancel a DRAFT or SCHEDULED campaign. Sending/sent blasts cannot be canceled. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const mass = await prisma.massEmail.findUnique({ where: { id }, select: { status: true } });
  if (!mass) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (mass.status !== "DRAFT" && mass.status !== "SCHEDULED") {
    return NextResponse.json({ error: `Cannot cancel a ${mass.status.toLowerCase()} campaign` }, { status: 409 });
  }
  await prisma.massEmail.update({ where: { id }, data: { status: "CANCELED" } });
  return NextResponse.json({ ok: true });
}
