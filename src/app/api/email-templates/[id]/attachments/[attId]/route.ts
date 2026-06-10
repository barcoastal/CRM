/**
 * Single attachment: download or delete.
 *
 * GET    /api/email-templates/[id]/attachments/[attId]   → file bytes
 * DELETE /api/email-templates/[id]/attachments/[attId]   → 204
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { deleteAttachment, readAttachment } from "@/lib/email/attachments-storage";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; attId: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id, attId } = await ctx.params;
  const att = await prisma.emailTemplateAttachment.findUnique({
    where: { id: attId },
    select: { id: true, templateId: true, filename: true, contentType: true, storagePath: true },
  });
  if (!att || att.templateId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let buf: Buffer;
  try {
    buf = await readAttachment(att.storagePath);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Read failed" },
      { status: 500 },
    );
  }
  // Convert to a fresh ArrayBuffer to satisfy BodyInit typing across Node runtimes.
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return new NextResponse(ab, {
    status: 200,
    headers: {
      "Content-Type": att.contentType || "application/octet-stream",
      "Content-Length": String(buf.byteLength),
      "Content-Disposition": `attachment; filename="${att.filename.replace(/"/g, "")}"`,
    },
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; attId: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id, attId } = await ctx.params;
  const att = await prisma.emailTemplateAttachment.findUnique({
    where: { id: attId },
    select: { id: true, templateId: true, storagePath: true },
  });
  if (!att || att.templateId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.emailTemplateAttachment.delete({ where: { id: attId } });
  // Best-effort filesystem cleanup. If the row was deleted but the file
  // lingers, the next nightly cleanup script will catch it.
  await deleteAttachment(att.storagePath);
  return new NextResponse(null, { status: 204 });
}
