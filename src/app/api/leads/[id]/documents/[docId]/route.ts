import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { serveDocument, deleteDocumentAndFile } from "@/lib/document-serve";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const r = await requireAuthOrRespond("Lead.View");
  if ("response" in r) return r.response;
  const { id, docId } = await params;
  const doc = await prisma.document.findFirst({ where: { id: docId, leadId: id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const view = new URL(request.url).searchParams.get("view") === "1";
  return serveDocument(doc, view);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const { id, docId } = await params;
  const doc = await prisma.document.findFirst({ where: { id: docId, leadId: id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteDocumentAndFile(docId, doc.filePath);
  return NextResponse.json({ ok: true });
}
