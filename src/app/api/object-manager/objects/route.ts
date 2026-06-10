import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { summarizeObjects } from "@/lib/object-manager/dmmf";

export const dynamic = "force-dynamic";

export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const summaries = summarizeObjects();
  const [labels, layouts] = await Promise.all([
    prisma.objectFieldLabel.groupBy({
      by: ["entityType"],
      _count: { _all: true },
    }),
    prisma.pageLayout.groupBy({
      by: ["entityType"],
      _count: { _all: true },
    }),
  ]);

  const labelByEntity = new Map<string, number>(
    labels.map((l) => [l.entityType, l._count._all]),
  );
  const layoutByEntity = new Map<string, number>(
    layouts.map((l) => [l.entityType, l._count._all]),
  );

  const items = summaries.map((s) => ({
    name: s.name,
    label: s.label,
    fieldCount: s.fieldCount,
    labelOverrideCount: labelByEntity.get(s.name) ?? 0,
    layoutCount: layoutByEntity.get(s.name) ?? 0,
  }));

  return NextResponse.json({ items });
}
