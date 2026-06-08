import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { deleteDocumentFolder } from "@/lib/files/storage";

// GET /api/files/[id] — full document with versions, record links, share links
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const doc = await prisma.contentDocument.findUnique({
    where: { id },
    include: {
      latestVersion: true,
      folder: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
      records: {
        include: { linkedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      shares: {
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

// PATCH /api/files/[id] — rename / move folder / edit description
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.description === "string") data.description = body.description;
  if (Object.prototype.hasOwnProperty.call(body, "folderId")) {
    const f = body.folderId;
    if (f === null || f === "" || f === "null") {
      data.folderId = null;
    } else if (typeof f === "string") {
      const folder = await prisma.contentLibraryFolder.findUnique({ where: { id: f } });
      if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      data.folderId = f;
    }
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const doc = await prisma.contentDocument.update({
    where: { id },
    data,
    include: { latestVersion: true, folder: true },
  }).catch(() => null);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

// DELETE /api/files/[id] — cascade versions on disk + DB
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const exists = await prisma.contentDocument.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Detach latestVersion to satisfy the SetNull FK before deleting versions.
  await prisma.contentDocument.update({ where: { id }, data: { latestVersionId: null } });
  await prisma.contentDocument.delete({ where: { id } });
  await deleteDocumentFolder(id);
  return NextResponse.json({ ok: true });
}
