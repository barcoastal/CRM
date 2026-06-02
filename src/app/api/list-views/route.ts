import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createListViewSchema } from "@/lib/validations/list-view";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity");
  if (!entity) {
    return NextResponse.json({ error: "entity required" }, { status: 400 });
  }
  // Return: system views + shared views + owned views
  const views = await prisma.listView.findMany({
    where: {
      entity,
      OR: [
        { isSystem: true },
        { isShared: true },
        { ownerId: r.session.userId },
      ],
    },
    orderBy: [{ isPinned: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ items: views });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = createListViewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const view = await prisma.listView.create({
    data: {
      entity: d.entity,
      name: d.name,
      developerName: d.developerName ?? null,
      filters: d.filters as object,
      columns: d.columns ? (d.columns as object) : undefined,
      sortField: d.sortField ?? null,
      sortDir: d.sortDir,
      isShared: d.isShared,
      isPinned: d.isPinned,
      ownerId: r.session.userId,
    },
  });
  return NextResponse.json(view, { status: 201 });
}
