import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const m = vi.hoisted(() => ({auth:vi.fn(),lead:vi.fn(),existing:vi.fn(),create:vi.fn(),update:vi.fn(),transaction:vi.fn()}));
vi.mock("@/lib/api-auth", () => ({requireAuthOrRespond:m.auth}));
vi.mock("@/lib/auth", () => ({auth:vi.fn()}));
vi.mock("@/lib/record-access", () => ({recordScope:vi.fn().mockResolvedValue({assignedToId:"me"})}));
vi.mock("@/lib/ssn-safe-json", () => ({ssnSafeJson:NextResponse.json}));
vi.mock("@/lib/prisma", () => ({prisma:{lead:{findFirst:m.lead,update:m.update},opportunity:{findUnique:m.existing,create:m.create},$transaction:m.transaction}}));
import { POST } from "../../src/app/api/opportunities/route";
const request=()=>new NextRequest("http://localhost/api/opportunities",{method:"POST",body:JSON.stringify({leadId:"one"})});
describe("opportunity creation",()=>{
  beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({session:{userId:"me"}});m.existing.mockResolvedValue(null);});
  it("requires create permission before reading leads",async()=>{
    m.auth.mockResolvedValue({response:NextResponse.json({},{status:403})});
    expect((await POST(request())).status).toBe(403);
    expect(m.auth).toHaveBeenCalledWith("Opportunity.Create");expect(m.lead).not.toHaveBeenCalled();
  });
  it("rejects inaccessible leads",async()=>{
    m.lead.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(m.lead).toHaveBeenCalledWith({where:{id:"one",AND:[{assignedToId:"me"}]}});
    expect(m.create).not.toHaveBeenCalled();
  });
  it("uses a transaction and defaults an unassigned lead's opportunity to its creator",async()=>{
    m.lead.mockResolvedValue({id:"one",businessName:"Example",assignedToId:null});
    m.transaction.mockResolvedValue([{id:"new",createdAt:new Date(),updatedAt:new Date(),expectedCloseDate:null}]);
    expect((await POST(request())).status).toBe(201);
    expect(m.create.mock.calls[0][0].data).toMatchObject({leadId:"one",name:"Example",assignedToId:"me"});
    expect(m.transaction).toHaveBeenCalledOnce();
  });
  it("returns a useful duplicate error without changing the lead",async()=>{
    m.lead.mockResolvedValue({id:"one"});m.existing.mockResolvedValue({id:"already"});
    expect((await POST(request())).status).toBe(409);expect(m.update).not.toHaveBeenCalled();
  });
});
