import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), deleteMany: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { deleteMany: mocks.deleteMany } } }));
vi.mock("@/lib/audit", () => ({ auditWrite: mocks.audit }));
vi.mock("@/lib/record-access", () => ({ recordScope: vi.fn().mockResolvedValue({ assignedToId: { in: ["u"] } }) }));
import { POST } from "../../src/app/api/bulk-edit/[entity]/route";
const request = () => new NextRequest("http://localhost/api/bulk-edit/lead", { method: "POST", body: JSON.stringify({ ids: ["lead1"], delete: true }), headers: { "Content-Type": "application/json" } });
const context = { params: Promise.resolve({ entity: "lead" }) };
describe("bulk deletion permission boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.deleteMany.mockResolvedValue({ count: 1 }); });
  it("rejects an edit-only user without deleting data", async () => {
    mocks.auth.mockResolvedValue({ session: { userId: "u", permissions: ["Lead.Edit"] } });
    const response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("allows the Delete permission independently of Edit", async () => {
    mocks.auth.mockResolvedValue({ session: { userId: "u", permissions: ["Lead.Delete"] } });
    expect((await POST(request(), context)).status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["lead1"] }, AND: [{ assignedToId: { in: ["u"] } }] } });
  });
  it("does not allow another object's Delete permission", async () => {
    mocks.auth.mockResolvedValue({ session: { userId: "u", permissions: ["Contact.Delete"] } });
    expect((await POST(request(), context)).status).toBe(403);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});
