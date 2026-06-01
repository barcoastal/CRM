import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateSmsSchema } from "@/lib/validations/sms-message";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("SMS.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const msg = await prisma.smsMessage.findUnique({ where: { id }, include: { owner: true } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(msg);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("SMS.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateSmsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "SENT") data.sentAt = new Date();
  if (parsed.data.status === "DELIVERED") data.deliveredAt = new Date();
  const msg = await prisma.smsMessage.update({ where: { id }, data });
  return NextResponse.json(msg);
}
