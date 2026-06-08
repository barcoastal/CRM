import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

// PATCH /api/files/folders/[id]  — rename or move
// DELETE /api/files/folders/[id] — only if empty
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (Object.prototype.hasOwnProperty.call(body, "parentId")) {
    const p = body.parentId;
    if (p === null || p === "" || p === "null") {
      data.parentId = null;
    } else if (typeof p === "string") {
      if (p === id) return NextResponse.json({ error: "Folder cannot be its own parent" }, { status: 400 });
      const parent = await prisma.contentLibraryFolder.findUnique({ where: { id: p } });
      if (!parent) return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
      data.parentId = p;
    }
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  const folder = await prisma.contentLibraryFolder.update({ where: { id }, data }).catch(() => null);
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(folder);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const folder = await prisma.contentLibraryFolder.findUnique({
    where: { id },
    include: { _count: { select: { files: true, children: true } } },
  });
  if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (folder._count.files > 0 || folder._count.children > 0) {
    return NextResponse.json(
      { error: `Folder is not empty (files: ${folder._count.files}, subfolders: ${folder._count.children})` },
      { status: 400 },
    );
  }
  await prisma.contentLibraryFolder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
