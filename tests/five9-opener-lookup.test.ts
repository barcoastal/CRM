import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  ids: vi.fn(),
  findMany: vi.fn(),
  scope: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.ids, lead: { findMany: mocks.findMany } } }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: vi.fn(async () => ({ session: { userId: "bar1" } })) }));
vi.mock("@/lib/record-access", () => ({ recordScope: mocks.scope }));

import { GET } from "@/app/api/leads/by-phone/route";

const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, sfId: `00Q-${id}`, sfDataJson: JSON.stringify({
    FirstName: "Alex", LastName: id, Alternate_Email__c: `${id}@example.com`,
    Street: "1 Main St", City: "Miami", PostalCode: "33101", MobilePhone: "3055551212",
    Work_Phone__c: "3055551313", pi__comments__c: "Imported comment", Has_Calendly_Event__c: true,
    LeadSource: "Phone Inquiry", Estimated_Total_Debt__c: "$50,000 - $100,000",
    Brand__c: "Coastal Debt", five9_Disposition__c: "CALLBACK",
  }),
  contactName: `Alex ${id}`, businessName: `Company ${id}`, phone: "8882804331",
  email: `${id}@coastaldebt.com`, status: "Working Lead", totalDebtEst: 10000,
  numberOfLenders: 2, industry: "Retail", lastContactedAt: null, state: "FL",
  ein: "123456789", utmTerm: "referral", notes: null,
  source: "OTHER", brand: null, createdAt: new Date("2025-01-02T00:00:00.000Z"), calls: [], ...overrides,
});

beforeEach(() => {
  mocks.ids.mockReset();
  mocks.findMany.mockReset();
  mocks.scope.mockReset().mockResolvedValue({ assignedToId: "bar1" });
});

it("returns every accessible lead matching a call number with its imported Salesforce details", async () => {
  mocks.ids.mockResolvedValue([{ id: "a" }, { id: "b" }]);
  mocks.findMany.mockResolvedValue([row("a"), row("b")]);

  const response = await GET(new NextRequest("https://crm.example/api/leads/by-phone?phone=8882804331"));
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.leads).toHaveLength(2);
  expect(body.leads.map((lead: { id: string }) => lead.id)).toEqual(["a", "b"]);
  expect(body.leads[0]).toMatchObject({
    sfId: "00Q-a", firstName: "Alex", lastName: "a", alternateEmail: "a@example.com",
    street: "1 Main St", city: "Miami", state: "FL", postalCode: "33101",
    mobilePhone: "3055551212", workPhone: "3055551313", ein: "123456789",
    utmTerm: "referral", comments: "Imported comment", hasCalendlyEvent: true,
    source: "Phone Inquiry", brand: "Coastal Debt", five9Disposition: "CALLBACK", debtRange: "$50,000 - $100,000", createdAt: "2025-01-02T00:00:00.000Z",
  });
  expect(mocks.findMany.mock.calls[0][0].where.AND).toEqual([{ assignedToId: "bar1" }]);
});

it("returns an empty list when the number has no accessible matches", async () => {
  mocks.ids.mockResolvedValue([{ id: "other" }]);
  mocks.findMany.mockResolvedValue([]);

  const response = await GET(new NextRequest("https://crm.example/api/leads/by-phone?phone=8882804331"));
  expect(await response.json()).toEqual({ leads: [] });
});
