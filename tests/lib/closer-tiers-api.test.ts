import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), upsert: vi.fn(), update: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { closerTierConfig: { upsert: mocks.upsert }, user: { update: mocks.update }, $transaction: mocks.transaction } }));
import { POST } from "@/app/api/closer-tiers/route";
const body = { tier1Max: 100_000, tier2Max: 250_000, assignments: [{ userId: "closer-a", tier: 2, isCloser: true }] };
const request = (value: unknown = body) => new NextRequest("http://localhost/api/closer-tiers", { method: "POST", body: JSON.stringify(value) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ session: { userId: "admin" } });
  mocks.upsert.mockReturnValue("config-operation");
  mocks.update.mockReturnValue("user-operation");
  mocks.transaction.mockResolvedValue([]);
});
describe("closer setup API", () => {
  it.each([401, 403])("requires setup permission before writing (%s)", async (status) => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({ error: "Forbidden" }, { status }) });
    expect((await POST(request())).status).toBe(status);
    expect(mocks.auth).toHaveBeenCalledWith("Setup.Admin");
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("saves the config and changed closer in one atomic transaction", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledWith(["config-operation", "user-operation"]);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ where: { id: "closer-a", isActive: true }, data: { closerTier: 2, isCloser: true } });
  });
  it("removes both the tier and closer status when explicitly removed", async () => {
    await POST(request({ ...body, assignments: [{ userId: "closer-a", tier: null, isCloser: false }] }));
    expect(mocks.update.mock.calls[0][0].data).toEqual({ closerTier: null, isCloser: false });
  });
  it("preserves legacy no-tier closer status when isCloser is omitted", async () => {
    await POST(request({ ...body, assignments: [{ userId: "closer-a", tier: null }] }));
    expect(mocks.update.mock.calls[0][0].data).toEqual({ closerTier: null });
  });
  it("changing debt limits alone leaves all users untouched", async () => {
    await POST(request({ ...body, assignments: [] }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledWith(["config-operation"]);
  });
  it("rejects invalid limits before touching the database", async () => {
    expect((await POST(request({ ...body, tier2Max: 100_000 }))).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("returns a recoverable conflict if a closer was removed or deactivated", async () => {
    mocks.transaction.mockRejectedValue({ code: "P2025" });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Refresh");
  });
});
