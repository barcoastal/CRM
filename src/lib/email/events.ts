/**
 * EmailEvent recording. The tracking routes and Resend webhook call recordEmailEvent
 * to append a granular engagement row alongside the fast per-message counters.
 * All writes are best-effort: callers wrap in try/catch or .catch so tracking
 * pixels and webhooks never fail because of an analytics write.
 */
import { prisma } from "@/lib/prisma";

export type EmailEventType =
  | "DELIVERED"
  | "OPEN"
  | "CLICK"
  | "BOUNCE"
  | "COMPLAINT"
  | "UNSUBSCRIBE"
  | "FAILED";

/** For open/click, "unique" means the first occurrence for that message. */
export function isUniqueEvent(
  type: EmailEventType,
  msg: { openedAt: Date | null; firstClickedAt: Date | null },
): boolean {
  if (type === "OPEN") return msg.openedAt === null;
  if (type === "CLICK") return msg.firstClickedAt === null;
  return true;
}

export async function recordEmailEvent(args: {
  emailMessageId: string;
  type: EmailEventType;
  url?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  massEmailId?: string | null;
  flowId?: string | null;
  ownerId?: string | null;
}): Promise<void> {
  try {
    await prisma.emailEvent.create({
      data: {
        emailMessageId: args.emailMessageId,
        type: args.type,
        url: args.url ?? null,
        userAgent: args.userAgent ?? null,
        ip: args.ip ?? null,
        massEmailId: args.massEmailId ?? null,
        flowId: args.flowId ?? null,
        ownerId: args.ownerId ?? null,
      },
    });
  } catch {
    // best-effort; analytics must never break the caller
  }
}
