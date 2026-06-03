import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const r = await requireAuthOrRespond("Account.Read");
  if ("response" in r) return r.response;
  const { id, docId } = await params;
  const doc = await prisma.document.findFirst({ where: { id: docId, accountId: id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const abs = path.isAbsolute(doc.filePath) ? doc.filePath : path.join(process.cwd(), doc.filePath);
  try {
    const buf = await fs.readFile(abs);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${doc.name}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 410 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { id, docId } = await params;
  const doc = await prisma.document.findFirst({ where: { id: docId, accountId: id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.document.delete({ where: { id: docId } });
  const abs = path.isAbsolute(doc.filePath) ? doc.filePath : path.join(process.cwd(), doc.filePath);
  await fs.unlink(abs).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
