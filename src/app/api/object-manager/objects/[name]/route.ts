import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { getObject } from "@/lib/object-manager/dmmf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const { name } = await params;
  const meta = getObject(name);
  if (!meta) {
    return NextResponse.json({ error: "Object not found" }, { status: 404 });
  }

  const [labels, layouts] = await Promise.all([
    prisma.objectFieldLabel.findMany({
      where: { entityType: name },
      orderBy: [{ sortOrder: "asc" }, { fieldName: "asc" }],
    }),
    prisma.pageLayout.findMany({
      where: { entityType: name },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
  ]);

  return NextResponse.json({
    meta,
    labels,
    layouts,
  });
}
