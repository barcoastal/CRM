/**
 * Lead Lists list + create.
 *   GET  /api/engagement/lists
 *   POST /api/engagement/lists
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";

export async function GET(_req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const items = await prisma.leadList.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { members: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const description = body?.description == null ? null : String(body.description);
  const criteria = body?.criteria ?? null;

  try {
    const list = await prisma.leadList.create({
      data: {
        name,
        description,
        ...(criteria ? { criteria: criteria as object } : {}),
        createdById: r.session.userId,
      },
    });
    await auditWrite({
      userId: r.session.userId,
      entity: "LeadList",
      entityId: list.id,
      action: "CREATE",
      after: list as unknown as Record<string, unknown>,
    });
    return NextResponse.json(list, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique")) {
      return NextResponse.json({ error: "A list with that name already exists" }, { status: 409 });
    }
    throw e;
  }
}
