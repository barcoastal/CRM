import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { saveFile, validateUpload } from "@/lib/files/storage";

// Central Files API.
// GET  /api/files                          list (filter by folderId, ownerId, q, take, skip)
// POST /api/files                          multipart upload: file, title, folderId?, description?

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId");
  const ownerId = url.searchParams.get("ownerId");
  const q = url.searchParams.get("q")?.trim();
  const take = Math.min(parseInt(url.searchParams.get("take") ?? "50", 10) || 50, 200);
  const skip = parseInt(url.searchParams.get("skip") ?? "0", 10) || 0;

  const where: Record<string, unknown> = {};
  if (folderId === "null" || folderId === "root") {
    where.folderId = null;
  } else if (folderId) {
    where.folderId = folderId;
  }
  if (ownerId) where.ownerId = ownerId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.contentDocument.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        latestVersion: true,
        owner: { select: { id: true, name: true, email: true } },
        folder: { select: { id: true, name: true } },
        _count: { select: { versions: true, records: true, shares: true } },
      },
      take,
      skip,
    }),
    prisma.contentDocument.count({ where }),
  ]);

  return NextResponse.json({ rows, total, take, skip });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const title = String(form.get("title") ?? file.name ?? "Untitled");
  const description = (form.get("description") as string | null) || null;
  const folderIdRaw = (form.get("folderId") as string | null) || null;
  const folderId = folderIdRaw && folderIdRaw !== "null" && folderIdRaw !== "" ? folderIdRaw : null;

  // Validate folder exists if provided
  if (folderId) {
    const f = await prisma.contentLibraryFolder.findUnique({ where: { id: folderId } });
    if (!f) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    validateUpload({ filename: file.name, contentType: file.type, byteSize: buffer.byteLength });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  // Create the document first (no latestVersionId yet), then write the version
  // file to disk, then create version row and set latestVersionId.
  const doc = await prisma.contentDocument.create({
    data: {
      title,
      description,
      folderId,
      ownerId: session.userId,
    },
  });

  let storagePath: string;
  try {
    storagePath = await saveFile(buffer, doc.id, 1, file.name);
  } catch (e) {
    await prisma.contentDocument.delete({ where: { id: doc.id } }).catch(() => null);
    return NextResponse.json({ error: `Failed to save file: ${(e as Error).message}` }, { status: 500 });
  }

  const version = await prisma.contentVersion.create({
    data: {
      documentId: doc.id,
      versionNumber: 1,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      byteSize: buffer.byteLength,
      storagePath,
      uploadedById: session.userId,
    },
  });

  const updated = await prisma.contentDocument.update({
    where: { id: doc.id },
    data: { latestVersionId: version.id },
    include: { latestVersion: true, folder: true, owner: { select: { id: true, name: true } } },
  });

  return NextResponse.json(updated, { status: 201 });
}
