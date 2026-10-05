import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), lead: vi.fn(), task: vi.fn(), update: vi.fn(), convert: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: m.auth }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: m.access }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findUnique: m.lead }, task: { create: m.task } } }));
vi.mock("@/lib/lead-conversion", () => ({ convertLead: m.convert }));
vi.mock("@/lib/triggers/runner", () => ({ makeCtx: vi.fn(), triggerUpdate: m.update }));
import { POST } from "@/app/api/leads/[id]/disposition/route";

const post = (stage = "Converted") => POST(new NextRequest("http://localhost/api/leads/lead/disposition", {
  method: "POST", body: JSON.stringify({ stage, subDisposition: "Test" }),
}), { params: Promise.resolve({ id: "lead" }) });

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ session: { userId: "admin" } });
  m.access.mockResolvedValue(true);
  m.lead.mockResolvedValue({ id: "lead", status: "New", sfDataJson: "{}" });
  m.task.mockResolvedValue({ id: "task" });
  m.convert.mockResolvedValue({ accountId: "account", contactId: "contact", opportunityId: "opportunity" });
});

it("rejects Converted before saving a task or changing status when call disposition is missing", async () => {
  const response = await post();
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain("Call Disposition is required");
  expect(m.task).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
  expect(m.convert).not.toHaveBeenCalled();
});

it("allows conversion when the health check call fields are complete", async () => {
  m.lead.mockResolvedValue({ id: "lead", status: "New", sfDataJson: JSON.stringify({ five9_Disposition__c: "Transferred", CloserLookup__c: "closer", Call_Transfer_Status__c: "Transferred", Call_Received_By_Lookup__c: "closer", Call_Received_Date__c: "2026-10-05" }) });
  expect((await post()).status).toBe(200);
  expect(m.convert).toHaveBeenCalledOnce();
});

it("still allows normal Working Lead disposition updates without transfer details", async () => {
  expect((await post("Working Lead")).status).toBe(200);
  expect(m.update).toHaveBeenCalledOnce();
  expect(m.convert).not.toHaveBeenCalled();
});
