/**
 * SMS templates for the Email Center Templates hub.
 *   GET  - list all SMS templates (newest first)
 *   POST - create one { name, body, description? }
 * Body carries the same {{token}} merge fields as email templates.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET() {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const items = await prisma.smsTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const body = (await req.json().catch(() => ({}))) as { name?: string; body?: string; description?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!body.body?.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
  const dupe = await prisma.smsTemplate.findUnique({ where: { name: body.name.trim() } });
  if (dupe) return NextResponse.json({ error: "A template with that name already exists" }, { status: 409 });
  const created = await prisma.smsTemplate.create({
    data: {
      name: body.name.trim(),
      body: body.body,
      description: body.description?.trim() || null,
      createdById: r.session.userId,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
