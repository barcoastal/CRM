import { beforeEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ findMany: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn(), create: vi.fn(), permissions: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { reportSubscription: { findMany: db.findMany, deleteMany: db.deleteMany }, $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ reportSubscription: { updateMany: db.updateMany }, reportDelivery: { create: db.create } }) } }));
vi.mock("@/lib/permissions", () => ({ loadEffectivePermissions: db.permissions, hasPermission: (permissions: string[], permission: string) => permissions.includes(permission) }));
import { queueReportEmails } from "@/lib/reports/subscriptions";
const due = { id: "s", reportId: "r", userId: "u", frequency: "weekly", weekday: 1, hourUtc: 9, nextRunAt: new Date("2026-09-21T09:00:00Z"), report: { isShared: true, createdById: "other" }, user: { isActive: true, role: "SALES_REP", email: "user@example.com" } };
beforeEach(() => { vi.clearAllMocks(); db.findMany.mockResolvedValue([due]); db.permissions.mockResolvedValue(new Set(["Reports.View"])); db.updateMany.mockResolvedValue({ count: 1 }); db.create.mockResolvedValue({}); });
it("queues only a personal report link and advances the claimed occurrence", async () => {
  expect(await queueReportEmails(new Date("2026-09-23T10:00:00Z"))).toBe(1);
  expect(db.create.mock.calls[0][0].data).toMatchObject({ subscriptionId: "s", payload: { to: ["user@example.com"], subject: "Your scheduled CRM report" } });
  expect(db.create.mock.calls[0][0].data.payload.text).toContain("/reports/r");
  expect(db.updateMany.mock.calls[0][0].where).toEqual({ id: "s", nextRunAt: due.nextRunAt });
  expect(db.updateMany.mock.calls[0][0].data.nextRunAt.toISOString()).toBe("2026-09-28T09:00:00.000Z");
});
it("does not deliver twice if another worker claims the occurrence", async () => {
  db.updateMany.mockResolvedValue({ count: 0 });
  expect(await queueReportEmails()).toBe(0); expect(db.create).not.toHaveBeenCalled();
});
it.each(["inactive", "revoked", "private"])("removes a subscription when access is %s", async kind => {
  db.findMany.mockResolvedValue([{ ...due, user: { ...due.user, isActive: kind !== "inactive" }, report: { ...due.report, isShared: kind !== "private" } }]);
  if (kind === "revoked") db.permissions.mockResolvedValue(new Set());
  expect(await queueReportEmails()).toBe(0);
  expect(db.deleteMany).toHaveBeenCalled(); expect(db.create).not.toHaveBeenCalled();
});
