import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), find: vi.fn(), transaction: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.user }, pageLayout: { findUnique: mocks.find }, $transaction: mocks.transaction } }));
vi.mock("@/lib/audit", () => ({ auditWrite: mocks.audit }));
import { PUT } from "@/app/api/record-field-layouts/route";
const request = (body: unknown) => new Request("http://localhost/api/record-field-layouts", { method: "PUT", body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ session: { userId: "admin" } }); mocks.user.mockResolvedValue({ role: "ADMIN", isActive: true }); mocks.find.mockResolvedValue(null); });
describe("record layout saves", () => {
  it("checks the current database role and denies non-admins", async () => {
    mocks.user.mockResolvedValue({ role: "SALES_REP", isActive: true });
    expect((await PUT(request({}))).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects unknown stages", async () => {
    expect((await PUT(request({ entity: "Lead", stage: "Invented", layout: {}, version: null }))).status).toBe(400);
  });
  it("rejects stale edits instead of overwriting newer changes", async () => {
    mocks.find.mockResolvedValue({ updatedAt: new Date("2026-10-08T10:00:00Z") });
    expect((await PUT(request({ entity: "Lead", stage: "*", layout: {}, version: null }))).status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("saves an authorized layout and returns its version", async () => {
    const created = { layout: {}, updatedAt: new Date("2026-10-08T10:00:00Z") };
    const create = vi.fn();
    mocks.transaction.mockImplementation(async work => work({ pageLayout: { create, findUniqueOrThrow: async () => created } }));
    const response = await PUT(request({ entity: "Lead", stage: "*", layout: {}, version: null }));
    expect(response.status).toBe(200); expect(create).toHaveBeenCalled(); expect(mocks.audit).toHaveBeenCalled();
  });
});
