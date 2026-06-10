/**
 * Flow Builder list + create API.
 *   GET  /api/flows[?entityType=Lead]
 *   POST /api/flows  { name, entityType, triggerEvent, ... }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { SUPPORTED_ENTITIES, TRIGGER_EVENTS, emptyGraph } from "@/lib/flow/nodes";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const items = await prisma.flow.findMany({
    where: entityType ? { entityType } : {},
    orderBy: [{ entityType: "asc" }, { name: "asc" }],
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { runs: true } },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));

  const name = String(body?.name ?? "").trim();
  const description = body?.description == null ? null : String(body.description);
  const entityType = String(body?.entityType ?? "");
  const triggerEvent = String(body?.triggerEvent ?? "INSERT_OR_UPDATE");
  const isActive = body?.isActive !== false;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!(SUPPORTED_ENTITIES as readonly string[]).includes(entityType)) {
    return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
  }
  if (!(TRIGGER_EVENTS as readonly string[]).includes(triggerEvent)) {
    return NextResponse.json({ error: "Invalid triggerEvent" }, { status: 400 });
  }

  const entryCriteria = body?.entryCriteria ?? { kind: "and", conditions: [] };
  const triggerOnFieldChanges = Array.isArray(body?.triggerOnFieldChanges)
    ? (body.triggerOnFieldChanges as unknown[]).filter((s) => typeof s === "string")
    : [];
  const graph = body?.graph ?? emptyGraph();

  const flow = await prisma.flow.create({
    data: {
      name,
      description,
      entityType,
      triggerEvent,
      isActive,
      entryCriteria: entryCriteria as object,
      triggerOnFieldChanges: triggerOnFieldChanges as object,
      graph: graph as object,
      createdById: r.session.userId,
    },
  });
  await auditWrite({
    userId: r.session.userId,
    entity: "Flow",
    entityId: flow.id,
    action: "CREATE",
    after: { name, entityType, triggerEvent },
  });
  return NextResponse.json({ flow }, { status: 201 });
}
