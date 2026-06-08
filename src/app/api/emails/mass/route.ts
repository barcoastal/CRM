/**
 * Mass Email collection endpoint.
 *
 *   GET  /api/emails/mass        — list recent blasts (newest first)
 *   POST /api/emails/mass        — create a draft blast
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET() {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;

  const items = await prisma.massEmail.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      template: { select: { id: true, name: true } },
      fromUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
    take: 200,
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    templateId?: string;
    fromUserId?: string;
    audienceType?: "filter" | "list";
    audienceFilter?: Record<string, unknown>;
    audienceIds?: string[];
  };

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (!body.templateId) {
    return NextResponse.json({ error: "templateId required" }, { status: 400 });
  }
  const audienceType = body.audienceType === "list" ? "list" : "filter";

  const tpl = await prisma.emailTemplate.findUnique({ where: { id: body.templateId }, select: { id: true } });
  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 400 });

  const created = await prisma.massEmail.create({
    data: {
      name: body.name.trim(),
      templateId: body.templateId,
      fromUserId: body.fromUserId ?? r.session.userId,
      audienceType,
      audienceFilter: (body.audienceFilter ?? {}) as object,
      audienceIds: Array.isArray(body.audienceIds) ? body.audienceIds : [],
      status: "DRAFT",
      createdById: r.session.userId,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
