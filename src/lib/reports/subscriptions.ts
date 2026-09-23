import { createReportSnapshot, canReadSnapshot, snapshotAttachments, type SavedSnapshot } from "./snapshots";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission, loadEffectivePermissions } from "@/lib/permissions";
import { nextReportRun, reportScheduleSchema } from "./schedule";
import { z } from "zod";
const emailPayloadSchema = z.object({ from: z.string().min(1), to: z.array(z.email()).length(1), subject: z.string(), text: z.string(), attachments: z.array(z.object({filename:z.string(),content:z.string()})).optional() });
type SubscriptionAccess = { userId: string; user: { isActive: boolean; role: string; email: string }; report: { isShared: boolean; createdById: string | null } };
async function allowed(item: SubscriptionAccess) {
  if (!item.user.isActive) return false;
  if (item.user.role === "ADMIN" || item.user.role === "SUPER_ADMIN") return true;
  const permissions = Array.from(await loadEffectivePermissions(item.userId));
  return hasPermission(permissions, "Reports.View") && (item.report.isShared || item.report.createdById === item.userId);
}
const accessInclude = { report: { select: { isShared: true, createdById: true } }, user: { select: { isActive: true, role: true, email: true } } } as const;

/** Durable outbox: create one email for an occurrence and advance the schedule atomically. */
export async function queueReportEmails(now = new Date()): Promise<number> {
  const due = await prisma.reportSubscription.findMany({ where: { nextRunAt: { lte: now } }, orderBy: { nextRunAt: "asc" }, take: 100, include: accessInclude });
  let queued = 0;
  for (const item of due) {
    const schedule = reportScheduleSchema.safeParse(item);
    if (!await allowed(item) || !schedule.success || !z.email().safeParse(item.user.email).success) {
      await prisma.reportSubscription.deleteMany({ where: { id: item.id, nextRunAt: item.nextRunAt } });
      continue;
    }
    const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://crm.coastaldebt-tools.com";
    const link = new URL(`/reports/${encodeURIComponent(item.reportId)}`, base);
    if (!["https:", "http:"].includes(link.protocol)) throw new Error("Invalid CRM URL for report emails");
    let snapshot: SavedSnapshot | undefined;
    let snapshotError: string | undefined;
    if (item.snapshotFormat === "csv") { try { snapshot = await createReportSnapshot(item.reportId, item.userId); } catch (e) { snapshotError = e instanceof Error ? e.message : "Snapshot generation failed"; } }
    const payload = { from: process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>", to: [item.user.email], subject: "Your scheduled CRM report", ...(snapshot ? { attachments: snapshotAttachments(snapshot) } : {}), text: `Open your scheduled report:\n${link.href}\n${snapshot ? `Snapshot captured ${snapshot.result.generatedAt}. Summaries cover all ${snapshot.result.rowCount} matching records; details contain ${snapshot.result.rows.length} rows.` : ""}\n\nSign in to see current results using your current permissions. Manage or cancel this schedule from the report's Schedule button.` };
    const created = await prisma.$transaction(async tx => {
      const claimed = await tx.reportSubscription.updateMany({ where: { id: item.id, nextRunAt: item.nextRunAt }, data: { nextRunAt: nextReportRun(schedule.data, now) } });
      if (!claimed.count) return false;
      await tx.reportDelivery.create({ data: { subscriptionId: item.id, scheduledFor: item.nextRunAt, payload, ...(snapshot ? {snapshot:snapshot as unknown as Prisma.InputJsonValue} : {}), ...(snapshotError ? {status:"FAILED",lastError:snapshotError.slice(0,200)} : {}) } });
      return true;
    });
    if (created) queued++;
  }
  return queued;
}

/** Retries keep the same provider idempotency key and payload, within its 24-hour window. */
export async function deliverReportEmails(now = new Date()): Promise<number> {
  if (!process.env.RESEND_API_KEY) return 0;
  const pending = await prisma.reportDelivery.findMany({ where: { status: "PENDING", OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] }, orderBy: { createdAt: "asc" }, take: 25, include: { subscription: { include: accessInclude } } });
  let sent = 0;
  for (const item of pending) {
    if (!await allowed(item.subscription)) {
      await prisma.reportDelivery.updateMany({ where: { id: item.id, status: "PENDING" }, data: { status: "CANCELLED", lastError: "Report access was removed." } });
      continue;
    }
    if (item.snapshot && !await canReadSnapshot(item.snapshot as unknown as SavedSnapshot, item.subscription.userId)) {
      await prisma.reportDelivery.updateMany({ where: { id: item.id, status: "PENDING" }, data: { status: "CANCELLED", lastError: "Snapshot access changed; open the live report for current results." } });
      continue;
    }
    const payload = emailPayloadSchema.safeParse(item.payload);
    if (!payload.success || payload.data.to[0] !== item.subscription.user.email) {
      await prisma.reportDelivery.updateMany({ where: { id: item.id, status: "PENDING" }, data: { status: "CANCELLED", lastError: "Recipient email changed or is invalid." } });
      continue;
    }
    // Never replay an uncertain send beyond the provider's deduplication window.
    if (item.firstAttemptAt && now.getTime() - item.firstAttemptAt.getTime() >= 23 * 60 * 60 * 1000) {
      await prisma.reportDelivery.updateMany({ where: { id: item.id, status: "PENDING" }, data: { status: "FAILED", lastError: "Delivery could not be confirmed within the retry window." } });
      continue;
    }
    const lease = new Date(now.getTime() + 5 * 60 * 1000);
    const claimed = await prisma.reportDelivery.updateMany({ where: { id: item.id, status: "PENDING", OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] }, data: { lockedUntil: lease, firstAttemptAt: item.firstAttemptAt ?? now, attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    try {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Idempotency-Key": `report-delivery/${item.id}` }, body: JSON.stringify(payload.data), signal: AbortSignal.timeout(20_000) });
      const body = await response.json().catch(() => ({})) as { id?: string };
      if (!response.ok || !body.id) throw new Error(`Email provider returned HTTP ${response.status}; retry pending.`);
      await prisma.reportDelivery.updateMany({ where: { id: item.id, status: "PENDING", lockedUntil: lease }, data: { status: "SENT", sentAt: new Date(), providerMessageId: body.id, lastError: null, lockedUntil: null } });
      sent++;
    } catch (error) {
      await prisma.reportDelivery.updateMany({ where: { id: item.id, status: "PENDING", lockedUntil: lease }, data: { lastError: error instanceof Error ? error.message.slice(0, 200) : "Email delivery failed; retry pending." } });
    }
  }
  return sent;
}
let armed = false;
let running = false;
export function scheduleReportReminders() {
  if (armed || process.env.NEXT_PHASE === "phase-production-build") return;
  armed = true;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await queueReportEmails(); await deliverReportEmails(); }
    catch (error) { console.error("[report-email]", error instanceof Error ? error.message : "Failed"); }
    finally { running = false; }
  };
  setTimeout(() => void tick(), 60_000).unref();
  setInterval(() => void tick(), 60_000).unref();
}
