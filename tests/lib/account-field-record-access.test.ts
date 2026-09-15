import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ guard: vi.fn(), read: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: vi.fn().mockResolvedValue({ session: { userId: "agent", permissions: ["Account.Edit"] } }) }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: mocks.guard }));
vi.mock("@/lib/prisma", () => ({ prisma: { account: { findUnique: mocks.read, update: mocks.write } } }));
import { PATCH } from "../../src/app/api/accounts/[id]/field/route";
it("rejects another team's inline edit despite Account.Edit permission", async () => {
  mocks.guard.mockResolvedValue(false);
  const response = await PATCH(new NextRequest("http://localhost/api/accounts/other/field", { method: "PATCH", body: JSON.stringify({ name: "Changed" }) }), { params: Promise.resolve({ id: "other" }) });
  expect(response.status).toBe(404);
  expect(mocks.guard).toHaveBeenCalledWith("account", "other");
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
});
