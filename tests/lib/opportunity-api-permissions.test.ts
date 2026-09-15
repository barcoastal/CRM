import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { opportunity: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/record-access", () => ({ recordScope: vi.fn().mockResolvedValue({}) }));
import { GET, PATCH, DELETE } from "../../src/app/api/opportunities/[id]/route";
describe("opportunity detail API permission boundary", () => {
  it.each([[GET, "View"], [PATCH, "Edit"], [DELETE, "Delete"]] as const)("checks the required action before accessing records (%s, %s)", async (handler, action) => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const response = await handler(new NextRequest("http://localhost/api/opportunities/one"), { params: Promise.resolve({ id: "one" }) });
    expect(response.status).toBe(403);
    expect(mocks.auth).toHaveBeenLastCalledWith(`Opportunity.${action}`);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
