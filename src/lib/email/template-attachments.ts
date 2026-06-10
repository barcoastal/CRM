/**
 * Load all attachments for a template and encode them into Resend's
 * { filename, content: base64 } payload shape.
 *
 * Used by both the single-message sender (email-sender.ts) and the mass
 * blast sender (mass-sender.ts) so a template's files ride along with
 * every email that references it.
 */
import { prisma } from "@/lib/prisma";
import { readAttachment } from "@/lib/email/attachments-storage";

export interface ResendAttachment {
  filename: string;
  content: string; // base64
  contentType?: string;
}

export async function loadResendAttachmentsForTemplate(
  templateId: string | null | undefined,
): Promise<ResendAttachment[]> {
  if (!templateId) return [];
  const rows = await prisma.emailTemplateAttachment.findMany({
    where: { templateId },
    select: { filename: true, contentType: true, storagePath: true },
  });
  if (rows.length === 0) return [];
  const out: ResendAttachment[] = [];
  for (const r of rows) {
    try {
      const buf = await readAttachment(r.storagePath);
      out.push({
        filename: r.filename,
        content: buf.toString("base64"),
        contentType: r.contentType || undefined,
      });
    } catch {
      // Skip files that can't be read; surfacing this would either kill a
      // send (bad) or silently drop one attachment (less bad). We pick the
      // latter for now; admins can audit via the template editor list.
    }
  }
  return out;
}
