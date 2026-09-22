import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/record-access", () => ({ recordScope: vi.fn().mockResolvedValue({ assignedToId: "me" }) }));
vi.mock("@/lib/audit", () => ({ auditWrite: mocks.audit }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (run: (tx: unknown) => unknown) => run({ opportunity: { updateMany: mocks.updateMany, findMany: mocks.findMany } }) } }));
import { POST } from "../../src/app/api/opportunities/labels/route";
const request = (operation = "add", label = "Priority") => new NextRequest("http://localhost/api/opportunities/labels", {method:"POST", body:JSON.stringify({ ids:["one"], label, operation })});
describe("opportunity label updates", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.auth.mockResolvedValue({ session: {userId:"me"} });
    mocks.updateMany.mockResolvedValue({count:1});
  });
  it("requires edit permission and does not write on rejection", async () => {
    mocks.auth.mockResolvedValue({response:NextResponse.json({}, {status:403})});
    expect((await POST(request())).status).toBe(403);
    expect(mocks.auth).toHaveBeenCalledWith("Opportunity.Edit");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("adds only to accessible records without adding duplicate labels", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({where:{id:{in:["one"]},AND:[{assignedToId:"me"}],NOT:{labels:{has:"Priority"}}},data:{labels:{push:"Priority"}}});
    expect(mocks.audit).toHaveBeenCalled();
  });
  it("removes only the requested label and protects concurrent changes", async () => {
    mocks.findMany.mockResolvedValue([{id:"one",labels:["Priority","Review"]}]);
    expect((await POST(request("remove"))).status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({where:{id:"one",AND:[{assignedToId:"me"}],labels:{equals:["Priority","Review"]}},data:{labels:["Review"]}});
  });
  it("returns a conflict instead of overwriting labels changed by another user", async () => {
    mocks.findMany.mockResolvedValue([{id:"one",labels:["Priority"]}]); mocks.updateMany.mockResolvedValue({count:0});
    expect((await POST(request("remove"))).status).toBe(409);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("rejects empty or oversized labels and unknown operations", async () => {
    expect((await POST(request("add", "   "))).status).toBe(400);
    expect((await POST(request("add", "x".repeat(61)))).status).toBe(400);
    expect((await POST(request("erase-all"))).status).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
