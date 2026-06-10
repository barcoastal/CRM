/**
 * Attachment list + upload for one EmailTemplate.
 *
 * GET   /api/email-templates/[id]/attachments   → list rows
 * POST  /api/email-templates/[id]/attachments   → multipart upload (file=...)
 *   Multiple "file" fields are accepted in one POST; each is written to the
 *   Railway volume and a DB row is inserted. Returns the new rows.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import {
  MAX_ATTACHMENT_BYTES,
  saveAttachment,
} from "@/lib/email/attachments-storage";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const tpl = await prisma.emailTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  const items = await prisma.emailTemplateAttachment.findMany({
    where: { templateId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, filename: true, contentType: true, byteSize: true, createdAt: true },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const tpl = await prisma.emailTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "multipart/form-data required" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid form data" },
      { status: 400 },
    );
  }

  const files = form.getAll("file").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files in upload" }, { status: 400 });
  }

  const created: Array<{
    id: string;
    filename: string;
    contentType: string;
    byteSize: number;
    createdAt: string;
  }> = [];

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: `File ${file.name} exceeds 25MB cap` },
        { status: 413 },
      );
    }
    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const storagePath = await saveAttachment(buf, file.name);
    const row = await prisma.emailTemplateAttachment.create({
      data: {
        templateId: id,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        byteSize: buf.byteLength,
        storagePath,
        uploadedById: r.session.userId,
      },
      select: { id: true, filename: true, contentType: true, byteSize: true, createdAt: true },
    });
    created.push({ ...row, createdAt: row.createdAt.toISOString() });
  }

  return NextResponse.json({ items: created }, { status: 201 });
}
