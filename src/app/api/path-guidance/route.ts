import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";

const ENTITY_TYPES = ["Lead", "Opportunity", "Account", "Case"] as const;

function normalizeKeyFields(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (t) out.push(t);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const where = entityType ? { entityType } : {};
  const items = await prisma.pathGuidance.findMany({
    where,
    orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }, { stage: "asc" }],
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));

  const entityType = String(body?.entityType ?? "");
  const stage = String(body?.stage ?? "").trim();
  if (!ENTITY_TYPES.includes(entityType as typeof ENTITY_TYPES[number])) {
    return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
  }
  if (!stage) {
    return NextResponse.json({ error: "stage required" }, { status: 400 });
  }
  const keyFields = normalizeKeyFields(body?.keyFields ?? []);
  if (keyFields === null) {
    return NextResponse.json({ error: "keyFields must be array of strings" }, { status: 400 });
  }
  const guidance = body?.guidance == null ? null : String(body.guidance);
  const sortOrder = Number.isFinite(body?.sortOrder) ? Number(body.sortOrder) : 0;
  const isActive = body?.isActive !== false;

  // Enforce unique (entityType, stage) via friendly 409 instead of P2002.
  const existing = await prisma.pathGuidance.findUnique({
    where: { entityType_stage: { entityType, stage } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Guidance for this entity + stage already exists" },
      { status: 409 },
    );
  }

  const created = await prisma.pathGuidance.create({
    data: {
      entityType,
      stage,
      keyFields: keyFields as object,
      guidance,
      sortOrder,
      isActive,
      createdById: r.session.userId,
    },
  });
  await auditWrite({
    userId: r.session.userId,
    entity: "PathGuidance",
    entityId: created.id,
    action: "CREATE",
    after: created as unknown as Record<string, unknown>,
  });
  return NextResponse.json(created, { status: 201 });
}
