/**
 * Email-channel suppression. Automated senders (flow send_email nodes, later
 * campaign sends) call isEmailSuppressed before creating a message. The
 * Resend webhook feeds the list on hard bounces and spam complaints.
 */
import { prisma } from "@/lib/prisma";

export function normalizeEmail(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/<([^>]+)>/);
  return (m?.[1] ?? raw).trim().toLowerCase();
}

/**
 * Given a Resend webhook event type and its bounce payload, return the
 * suppression reason to record, or null when the event is not suppressing.
 * Transient and Undetermined bounces are temporary or ambiguous and do not suppress.
 */
export function decideSuppression(
  eventType: string,
  bounce: { type?: string } | undefined,
): "HARD_BOUNCE" | "COMPLAINT" | null {
  if (eventType === "email.complained") return "COMPLAINT";
  if (eventType === "email.bounced") {
    const bt = bounce?.type?.toLowerCase();
    if (bt === "transient" || bt === "undetermined") return null;
    return "HARD_BOUNCE";
  }
  return null;
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const norm = normalizeEmail(email);
  if (!norm) return true; // nothing to send to
  const hit = await prisma.emailSuppression.findUnique({ where: { email: norm } });
  return Boolean(hit);
}

export async function addEmailSuppression(
  email: string,
  reason: "HARD_BOUNCE" | "COMPLAINT" | "UNSUBSCRIBE" | "MANUAL",
  source?: string,
): Promise<void> {
  const norm = normalizeEmail(email);
  if (!norm || !norm.includes("@")) return;
  await prisma.emailSuppression.upsert({
    where: { email: norm },
    update: { reason, source: source ?? null },
    create: { email: norm, reason, source: source ?? null },
  });
}
