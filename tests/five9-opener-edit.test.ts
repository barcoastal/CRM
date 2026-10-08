import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), access: vi.fn(), findUnique: vi.fn(), update: vi.fn(), audit: vi.fn(), validate: vi.fn(),
}));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: mocks.access }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/triggers/runner", () => ({ triggerUpdate: mocks.update, makeCtx: (userId: string) => ({ userId }) }));
vi.mock("@/lib/audit", () => ({ auditWrite: mocks.audit }));
vi.mock("@/lib/validation/lead-validation", () => ({ validateLeadPatch: mocks.validate }));

import { PATCH } from "@/app/api/leads/[id]/five9-context/route";

const request = (body: unknown) => new NextRequest("https://crm.example/api/leads/lead-1/five9-context", {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const params = { params: Promise.resolve({ id: "lead-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ session: { userId: "bar1" } });
  mocks.access.mockResolvedValue(true);
  mocks.findUnique.mockResolvedValue({
    id: "lead-1", contactName: "Alex Smith", businessName: "Old Co", phone: "8882804331",
    email: "old@example.com", status: "Working Lead", sfDataJson: JSON.stringify({
      FirstName: "Alex", LastName: "Smith", LeadSource: "Phone Inquiry", Existing_Field__c: "keep",
    }),
  });
  mocks.validate.mockReturnValue([]);
  mocks.update.mockResolvedValue({ id: "lead-1" });
  mocks.audit.mockResolvedValue(undefined);
});

it("saves editable Five9 fields together and keeps unrelated Salesforce data", async () => {
  const response = await PATCH(request({
    firstName: "Alexa", source: "Google", brand: "BDI", debtRange: "$50,000 - $100,000",
    mobilePhone: "3055551212", totalDebtEst: 75000,
  }), params);
  expect(response.status).toBe(200);
  const [, id, data] = mocks.update.mock.calls[0];
  expect(id).toBe("lead-1");
  expect(data).toMatchObject({ contactName: "Alexa Smith", source: "Google", brand: "BDI", totalDebtEst: 75000 });
  expect(JSON.parse(data.sfDataJson)).toMatchObject({
    FirstName: "Alexa", LastName: "Smith", LeadSource: "Google", Brand__c: "BDI",
    Estimated_Total_Debt__c: "$50,000 - $100,000", MobilePhone: "3055551212",
    Existing_Field__c: "keep",
  });
});

it("rejects hidden fields and never writes outside the editable form", async () => {
  const response = await PATCH(request({ assignedToId: "other-agent" }), params);
  expect(response.status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});

it("does not expose or edit an inaccessible lead", async () => {
  mocks.access.mockResolvedValue(false);
  const response = await PATCH(request({ source: "Google" }), params);
  expect(response.status).toBe(404);
  expect(mocks.findUnique).not.toHaveBeenCalled();
});
