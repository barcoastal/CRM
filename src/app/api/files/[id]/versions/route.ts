import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { saveFile, validateUpload } from "@/lib/files/storage";

// POST /api/files/[id]/versions — multipart upload of a new version
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await ctx.params;

  const doc = await prisma.contentDocument.findUnique({
    where: { id },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    validateUpload({ filename: file.name, contentType: file.type, byteSize: buffer.byteLength });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const next = (doc.versions[0]?.versionNumber ?? 0) + 1;
  let storagePath: string;
  try {
    storagePath = await saveFile(buffer, doc.id, next, file.name);
  } catch (e) {
    return NextResponse.json({ error: `Failed to save file: ${(e as Error).message}` }, { status: 500 });
  }
  const version = await prisma.contentVersion.create({
    data: {
      documentId: doc.id,
      versionNumber: next,
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
    include: { latestVersion: true },
  });
  return NextResponse.json({ document: updated, version }, { status: 201 });
}
