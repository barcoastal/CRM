import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateEmailSchema } from "@/lib/validations/email-message";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const msg = await prisma.emailMessage.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true } },
      template: true,
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, fullName: true } },
      lead: { select: { id: true, contactName: true } },
      opportunity: { select: { id: true, recordType: true } },
      case: { select: { id: true, caseNumber: true, subject: true } },
    },
  });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(msg);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "SENT") data.sentAt = new Date();
  if (parsed.data.status === "DELIVERED") data.deliveredAt = new Date();
  const msg = await prisma.emailMessage.update({ where: { id }, data });
  return NextResponse.json(msg);
}
