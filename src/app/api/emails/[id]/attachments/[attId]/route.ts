// src/app/api/emails/[id]/attachments/[attId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { readAttachment } from "@/lib/email/attachments-storage";
import { makeGmailWriteClient, gmailConfigured } from "@/lib/google/gmail-client";

export const dynamic = "force-dynamic";
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

/**
 * GET streams one attachment. Outgoing files come from the /data volume;
 * inbound Gmail attachments are fetched live from the owner's mailbox.
 * Access: admins, or the owner of the parent message.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; attId: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id, attId } = await ctx.params;

  const att = await prisma.emailAttachment.findUnique({
    where: { id: attId },
    include: { message: { select: { id: true, ownerId: true, gmailMessageId: true, owner: { select: { email: true } } } } },
  });
  if (!att || att.messageId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = ADMIN_ROLES.includes(r.session.role);
  if (!isAdmin && att.message.ownerId !== r.session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let bytes: Buffer;
  if (att.storagePath) {
    bytes = await readAttachment(att.storagePath);
  } else if (att.gmailAttachmentId && att.message.gmailMessageId && att.message.owner?.email) {
    if (!gmailConfigured()) return NextResponse.json({ error: "Gmail not configured" }, { status: 400 });
    const client = makeGmailWriteClient(att.message.owner.email.toLowerCase());
    bytes = await client.getAttachment(att.message.gmailMessageId, att.gmailAttachmentId);
  } else {
    return NextResponse.json({ error: "Unavailable" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": att.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${att.filename.replace(/"/g, "")}"`,
      "Content-Length": String(bytes.byteLength),
    },
  });
}
