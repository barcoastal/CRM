import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createEmailTemplateSchema } from "@/lib/validations/email-template";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder");
  const where: Record<string, unknown> = { isActive: true };
  if (folder) where.folder = folder;
  const items = await prisma.emailTemplate.findMany({
    where, orderBy: { name: "asc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = createEmailTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const tpl = await prisma.emailTemplate.create({
    data: { ...parsed.data, createdById: r.session.userId },
  });
  return NextResponse.json(tpl, { status: 201 });
}
