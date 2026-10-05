import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), read: vi.fn(), write: vi.fn(), history: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: m.auth }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: m.access, recordScope: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/prisma", () => ({ prisma: { account: { findUnique: m.read, update: m.write }, accountHistory: { create: m.history } } }));
vi.mock("@/lib/audit", () => ({ auditWrite: m.audit }));
import { PATCH } from "@/app/api/accounts/[id]/field/route";
import { PATCH as editAccount } from "@/app/api/accounts/[id]/route";
const save = (key: string, value: string | null) => PATCH(new NextRequest("http://localhost/api/accounts/account/field", {
  method: "PATCH", body: JSON.stringify({ [key]: value }),
}), { params: Promise.resolve({ id: "account" }) });
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ session: { userId: "agent", permissions: ["Account.Edit"] } });
  m.access.mockResolvedValue(true);
  m.read.mockResolvedValue({ id: "account", name: "Business", sfDataJson: '{"Company":"Preserved"}' });
  m.write.mockImplementation(async ({ data }) => ({ id: "account", ...data }));
  m.history.mockResolvedValue({}); m.audit.mockResolvedValue({});
});
it.each([
  ["ein", "EIN_Number_Tax_Id__c", "12-3456789"],
  ["billingStreet", "BillingStreet", "123 Main St"],
  ["billingCity", "BillingCity", "Miami"],
  ["billingState", "BillingState", "FL"],
  ["billingZip", "BillingPostalCode", "00123"],
  ["billingCountry", "BillingCountry", "US"],
])("saves shared %s to the account and its imported mirror with history", async (key, sfKey, value) => {
  const response = await save(key, value);
  expect(response.status).toBe(200);
  const { account } = await response.json();
  expect(account[key]).toBe(value);
  expect(JSON.parse(account.sfDataJson)).toEqual({ Company: "Preserved", [sfKey]: value });
  expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "account" }) }));
  expect(m.history).toHaveBeenCalledOnce(); expect(m.audit).toHaveBeenCalledOnce();
});
it("clears EIN in both representations so an imported old value cannot reappear", async () => {
  m.read.mockResolvedValue({ id: "account", ein: "12-3456789", sfDataJson: '{"EIN_Number_Tax_Id__c":"12-3456789"}' });
  const response = await save("ein", null);
  expect(response.status).toBe(200);
  const { account } = await response.json();
  expect(account.ein).toBeNull(); expect(JSON.parse(account.sfDataJson).EIN_Number_Tax_Id__c).toBeNull();
});
it("rejects edits to an inaccessible account", async () => {
  m.access.mockResolvedValue(false);
  expect((await save("billingCity", "Miami")).status).toBe(404);
  expect(m.write).not.toHaveBeenCalled();
});
it("mirrors full account edits and clearing so both record pages show the same values", async () => {
  m.read.mockResolvedValue({ id: "account", name: "Business", ein: "old", billingCity: "Old City", sfDataJson: '{"Company":"Preserved","EIN_Number_Tax_Id__c":"old","BillingCity":"Old City"}' });
  const response = await editAccount(new NextRequest("http://localhost/api/accounts/account", {
    method: "PATCH", body: JSON.stringify({ ein: null, billingCity: "New City", billingZip: "00123" }),
  }), { params: Promise.resolve({ id: "account" }) });
  expect(response.status).toBe(200);
  const account = await response.json();
  expect(account.ein).toBeNull(); expect(account.billingCity).toBe("New City");
  expect(JSON.parse(account.sfDataJson)).toEqual({ Company: "Preserved", EIN_Number_Tax_Id__c: null, BillingCity: "New City", BillingPostalCode: "00123" });
});
