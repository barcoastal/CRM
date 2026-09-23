import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const db = vi.hoisted(() => ({ access: vi.fn(), report: vi.fn(), upsert: vi.fn(), find: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/analytics-access", () => ({ analyticsApiAccess: db.access, definitionScope: () => ({ OR: [{ isShared: true }, { createdById: "me" }] }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { report: { findFirst: db.report }, reportSubscription: { upsert: db.upsert, findUnique: db.find, deleteMany: db.remove } } }));
import { GET, PUT, DELETE } from "@/app/api/reports/[id]/subscription/route";
const ctx = { params: Promise.resolve({ id: "report" }) };
const request = (body: unknown = {}) => new NextRequest("http://localhost/api/reports/report/subscription", { method: "PUT", body: JSON.stringify(body) });
beforeEach(() => { vi.stubEnv("RESEND_API_KEY", "test-key"); vi.clearAllMocks(); db.access.mockResolvedValue({ access: { userId: "me" } }); db.report.mockResolvedValue({ id: "report" }); db.upsert.mockResolvedValue({ id: "schedule" }); db.find.mockResolvedValue(null); });
it("stores the current user's schedule regardless of supplied userId", async () => {
  const response = await PUT(request({ frequency: "daily", hourUtc: 9, weekday: 1, userId: "someone-else" }), ctx);
  expect(response.status).toBe(200);
  expect(db.upsert.mock.calls[0][0].create.userId).toBe("me");
  expect(db.report.mock.calls[0][0].where.AND).toEqual([{ OR: [{ isShared: true }, { createdById: "me" }] }]);
});
it("denies inaccessible reports and invalid schedules", async () => {
  db.report.mockResolvedValue(null);
  expect((await PUT(request({ frequency: "daily", hourUtc: 9 }), ctx)).status).toBe(404);
  db.report.mockResolvedValue({ id: "report" });
  expect((await PUT(request({ frequency: "daily", hourUtc: 24 }), ctx)).status).toBe(400);
  expect(db.upsert).not.toHaveBeenCalled();
});
it("reads and removes only the current user's subscription", async () => {
  await GET(request(), ctx); await DELETE(request(), ctx);
  expect(db.find.mock.calls[0][0].where).toEqual({ reportId_userId: { reportId: "report", userId: "me" } });
  expect(db.remove.mock.calls[0][0].where).toEqual({ reportId: "report", userId: "me" });
});
it("returns the permission gate before touching records", async () => {
  db.access.mockResolvedValue({ response: Response.json({ error: "Forbidden" }, { status: 403 }) });
  expect((await PUT(request(), ctx)).status).toBe(403);
  expect(db.report).not.toHaveBeenCalled();
});

it("does not advertise a working email schedule without a configured provider", async () => {
  vi.stubEnv("RESEND_API_KEY", "");
  expect((await PUT(request({ frequency: "daily", hourUtc: 9 }), ctx)).status).toBe(503);
  expect(db.upsert).not.toHaveBeenCalled();
});
