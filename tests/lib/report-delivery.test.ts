vi.mock("@/lib/reports/snapshots", () => ({ createReportSnapshot: vi.fn(), canReadSnapshot: vi.fn().mockResolvedValue(true), snapshotAttachments: vi.fn().mockReturnValue([]) }));
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn(), permissions: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { reportDelivery: { findMany: db.findMany, updateMany: db.updateMany } } }));
vi.mock("@/lib/permissions", () => ({ loadEffectivePermissions: db.permissions, hasPermission: (p: string[], k: string) => p.includes(k) }));
import { deliverReportEmails } from "@/lib/reports/subscriptions";
const now = new Date("2026-09-23T10:00:00Z");
const item = { id: "delivery", status: "PENDING", firstAttemptAt: null, payload: { from: "CRM <noreply@example.com>", to: ["user@example.com"], subject: "Your report", text: "https://crm.example.com/reports/r" }, subscription: { userId: "u", user: { email: "user@example.com", isActive: true, role: "SALES_REP" }, report: { isShared: true, createdById: "other" } } };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("RESEND_API_KEY", "test-key"); vi.stubGlobal("fetch", db.fetch); db.findMany.mockResolvedValue([item]); db.permissions.mockResolvedValue(new Set(["Reports.View"])); db.updateMany.mockResolvedValue({ count: 1 }); db.fetch.mockResolvedValue(Response.json({ id: "provider-id" })); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("sends the stored payload with a stable idempotency key and records success", async () => {
  expect(await deliverReportEmails(now)).toBe(1);
  const options = db.fetch.mock.calls[0][1];
  expect(options.headers["Idempotency-Key"]).toBe("report-delivery/delivery");
  expect(JSON.parse(options.body)).toEqual(item.payload);
  expect(db.updateMany.mock.calls[1][0].data).toMatchObject({ status: "SENT", providerMessageId: "provider-id", lastError: null });
});
it("leaves provider failures pending for retry with the same occurrence", async () => {
  db.fetch.mockResolvedValue(Response.json({}, { status: 503 }));
  expect(await deliverReportEmails(now)).toBe(0);
  expect(db.updateMany.mock.calls[1][0].data.lastError).toContain("503");
  expect(db.updateMany.mock.calls[1][0].data.status).toBeUndefined();
});
it("does not send if another worker owns the lease", async () => {
  db.updateMany.mockResolvedValue({ count: 0 });
  expect(await deliverReportEmails(now)).toBe(0); expect(db.fetch).not.toHaveBeenCalled();
});
it("stops uncertain retries before the provider idempotency window expires", async () => {
  db.findMany.mockResolvedValue([{ ...item, firstAttemptAt: new Date("2026-09-22T10:00:00Z") }]);
  expect(await deliverReportEmails(now)).toBe(0); expect(db.fetch).not.toHaveBeenCalled();
  expect(db.updateMany.mock.calls[0][0].data.status).toBe("FAILED");
});
it("rechecks report permission immediately before delivery", async () => {
  db.permissions.mockResolvedValue(new Set());
  expect(await deliverReportEmails(now)).toBe(0); expect(db.fetch).not.toHaveBeenCalled();
  expect(db.updateMany.mock.calls[0][0].data.status).toBe("CANCELLED");
});
it("cancels a queued recipient after their CRM email changes", async () => {
  db.findMany.mockResolvedValue([{ ...item, subscription: { ...item.subscription, user: { ...item.subscription.user, email: "changed@example.com" } } }]);
  expect(await deliverReportEmails(now)).toBe(0); expect(db.fetch).not.toHaveBeenCalled();
});
it("does not consume deliveries without provider configuration", async () => {
  vi.stubEnv("RESEND_API_KEY", "");
  expect(await deliverReportEmails(now)).toBe(0); expect(db.findMany).not.toHaveBeenCalled();
});

import { canReadSnapshot } from "@/lib/reports/snapshots";
it("cancels CSV delivery when record membership changes before sending", async () => {
  db.findMany.mockResolvedValue([{...item,snapshot:{config:{},result:{}}}]);
  vi.mocked(canReadSnapshot).mockResolvedValue(false);
  expect(await deliverReportEmails(now)).toBe(0);
  expect(db.fetch).not.toHaveBeenCalled();
  expect(db.updateMany.mock.calls[0][0].data.status).toBe("CANCELLED");
});
