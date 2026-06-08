import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

// GET  /api/files/folders?parentId=  — list folders
// POST /api/files/folders             — { name, parentId? } create
export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const parentIdRaw = url.searchParams.get("parentId");
  const tree = url.searchParams.get("tree") === "1";

  if (tree) {
    // Return everything; client builds the tree.
    const all = await prisma.contentLibraryFolder.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { files: true, children: true } } },
    });
    return NextResponse.json(all);
  }

  const where: Record<string, unknown> = {};
  if (parentIdRaw === "null" || parentIdRaw === "root") where.parentId = null;
  else if (parentIdRaw) where.parentId = parentIdRaw;

  const folders = await prisma.contentLibraryFolder.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { files: true, children: true } } },
  });
  return NextResponse.json(folders);
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  let parentId: string | null = null;
  if (body.parentId && body.parentId !== "null" && body.parentId !== "root") {
    const parent = await prisma.contentLibraryFolder.findUnique({ where: { id: body.parentId } });
    if (!parent) return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    parentId = body.parentId;
  }
  const folder = await prisma.contentLibraryFolder.create({
    data: { name, parentId, ownerId: session.userId },
  });
  return NextResponse.json(folder, { status: 201 });
}
