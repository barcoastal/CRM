/** POST { entity, filters } returns how many mailable records match. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { buildWhere, type ListFilter } from "@/lib/list-views";

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const body = (await req.json().catch(() => ({}))) as { entity?: string; filters?: unknown };
  const entity = body.entity === "Contact" ? "Contact" : "Lead";
  const filters = (Array.isArray(body.filters) ? body.filters : []) as ListFilter[];
  const where = { email: { not: null }, ...buildWhere(filters) };
  const count =
    entity === "Lead"
      ? await prisma.lead.count({ where: where as never })
      : await prisma.contact.count({ where: where as never });
  return NextResponse.json({ count });
}
