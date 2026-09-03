// src/app/api/emails/attachments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { saveAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/email/attachments-storage";

export const dynamic = "force-dynamic";

/**
 * POST multipart/form-data with a single "file". Saves it to the /data volume
 * and returns a stash token the composer references. The stash is a small
 * cookie-free approach: we return storagePath + metadata and the client echoes
 * them back on send. (No DB row until the message is actually sent, so orphaned
 * uploads are just files on disk cleaned by ops if needed.)
 */
export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_ATTACHMENT_BYTES} bytes)` }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const storagePath = await saveAttachment(buf, file.name);
  return NextResponse.json({
    storagePath,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    byteSize: buf.byteLength,
  });
}
