import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { readFile } from "@/lib/files/storage";

// GET /api/files/[id]/download?version=N — streams the latest version (or N)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const versionParam = url.searchParams.get("version");

  const doc = await prisma.contentDocument.findUnique({
    where: { id },
    include: { latestVersion: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let version = doc.latestVersion;
  if (versionParam) {
    const n = parseInt(versionParam, 10);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "Invalid version" }, { status: 400 });
    }
    version = await prisma.contentVersion.findUnique({
      where: { documentId_versionNumber: { documentId: id, versionNumber: n } },
    });
  }
  if (!version) return NextResponse.json({ error: "No version found" }, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readFile(version.storagePath);
  } catch {
    return NextResponse.json({ error: "File missing from storage" }, { status: 410 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": version.contentType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(version.filename)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
