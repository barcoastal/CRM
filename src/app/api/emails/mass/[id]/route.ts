/**
 * Mass Email detail / update / delete.
 *
 *   GET    /api/emails/mass/[id]  — blast metadata + list of EmailMessage rows
 *   PATCH  /api/emails/mass/[id]  — only allowed while status === "DRAFT"
 *   DELETE /api/emails/mass/[id]  — only allowed while status === "DRAFT"
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const mass = await prisma.massEmail.findUnique({
    where: { id },
    include: {
      template: { select: { id: true, name: true, subject: true } },
      fromUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!mass) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await prisma.emailMessage.findMany({
    where: { massEmailId: id },
    select: {
      id: true,
      toAddresses: true,
      subject: true,
      status: true,
      sentAt: true,
      openedAt: true,
      firstClickedAt: true,
      openCount: true,
      clickCount: true,
      errorReason: true,
      lead: { select: { id: true, contactName: true, businessName: true } },
      contact: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  return NextResponse.json({ massEmail: mass, messages });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const existing = await prisma.massEmail.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Can only edit DRAFT blasts" }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    templateId?: string;
    fromUserId?: string;
    audienceType?: "filter" | "list";
    audienceFilter?: Record<string, unknown>;
    audienceIds?: string[];
  };
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.templateId !== undefined) data.templateId = body.templateId;
  if (body.fromUserId !== undefined) data.fromUserId = body.fromUserId;
  if (body.audienceType !== undefined) data.audienceType = body.audienceType;
  if (body.audienceFilter !== undefined) data.audienceFilter = body.audienceFilter;
  if (body.audienceIds !== undefined) data.audienceIds = body.audienceIds;

  const updated = await prisma.massEmail.update({ where: { id }, data });
  return NextResponse.json({ ok: true, massEmail: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const existing = await prisma.massEmail.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Can only delete DRAFT blasts" }, { status: 409 });
  }
  await prisma.massEmail.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
