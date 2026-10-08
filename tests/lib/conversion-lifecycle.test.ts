import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Opportunity } from "@/generated/prisma/client";
import type { TriggerCtx } from "@/lib/triggers/types";

const db = vi.hoisted(() => ({
  pageLayout: { findMany: vi.fn() },
  lead: { findUnique: vi.fn(), update: vi.fn() },
  account: { create: vi.fn(), update: vi.fn() },
  contact: { create: vi.fn() },
  accountContactRelation: { create: vi.fn() },
  opportunity: { create: vi.fn() },
  opportunityHistory: { create: vi.fn() },
  task: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/audit", () => ({ auditWrite: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/marketing/postback", () => ({ firePostbackEvent: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/automation/opportunity-cadences", () => ({ syncOpportunityCadences: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/validation-rules/evaluator", () => ({ runRulesFor: vi.fn() }));
import { convertLead } from "@/lib/lead-conversion";
import { opportunityTrigger } from "@/lib/triggers/opportunity-trigger";

describe("conversion account lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.pageLayout.findMany.mockResolvedValue([]);
    db.$transaction.mockImplementation(async (fn) => fn(db));
    db.lead.findUnique.mockResolvedValue({ id: "lead", businessName: "Example", contactName: "Test Person", totalDebtEst: 10000, debts: [], calls: [], sfDataJson: JSON.stringify({ five9_Disposition__c: "Transferred", CloserLookup__c: "closer", Call_Transfer_Status__c: "Transferred", Call_Received_By_Lookup__c: "closer", Call_Received_Date__c: "2026-10-05" }) });
    db.account.create.mockResolvedValue({ id: "account", name: "Example" });
    db.contact.create.mockResolvedValue({ id: "contact" });
    db.opportunity.create.mockResolvedValue({ id: "opportunity" });
    db.account.update.mockResolvedValue({});
  });

  it("creates an inactive account and returns the new opportunity", async () => {
    const result = await convertLead("lead");
    expect(db.account.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ clientStatus: "Inactive" }) }));
    expect(result.opportunityId).toBe("opportunity");
  });

  it("keeps an account inactive when opportunity creation is skipped", async () => {
    const result = await convertLead("lead", { doNotCreateOpportunity: true });
    expect(db.account.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ clientStatus: "Inactive" }) }));
    expect(result.opportunityId).toBeNull();
    expect(db.opportunity.create).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "{}", "null", "broken json", '{"five9_Disposition__c":"Transferred"}'])("blocks conversion without complete call disposition (%s) before any writes", async sfDataJson => {
    db.lead.findUnique.mockResolvedValue({ id: "lead", businessName: "Example", totalDebtEst: 10000, debts: [], sfDataJson });
    await expect(convertLead("lead", { performedById: "admin", skipValidation: true })).rejects.toThrow("Call Disposition is required");
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.account.create).not.toHaveBeenCalled();
    expect(db.lead.update).not.toHaveBeenCalled();
  });

  it.each(["five9_Disposition__c", "CloserLookup__c", "Call_Transfer_Status__c", "Call_Received_By_Lookup__c", "Call_Received_Date__c"])("blocks conversion when %s is blank", async field => {
    const lead = await db.lead.findUnique();
    const sfData = JSON.parse(lead.sfDataJson);
    sfData[field] = "   ";
    db.lead.findUnique.mockResolvedValue({ ...lead, sfDataJson: JSON.stringify(sfData) });
    await expect(convertLead("lead")).rejects.toThrow("Call Disposition is required");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("keeps already converted leads idempotent even if historical call data is missing", async () => {
    db.lead.findUnique.mockResolvedValue({ convertedAccountId: "account", convertedContactId: "contact", convertedOpportunityId: "opportunity" });
    await expect(convertLead("lead")).resolves.toEqual({ accountId: "account", contactId: "contact", opportunityId: "opportunity", alreadyConverted: true });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["Working Opportunity", null],
    ["Closed Won First Payment Pending", "Waiting First Payment"],
    ["Closed Won - First Payment Completed", "Active"],
  ])("handles stage %s without premature activation", async (stage, expectedStatus) => {
    const prev = { id: "opportunity", accountId: "account", stage: "New" } as Opportunity;
    await opportunityTrigger.afterUpdate!({
      prev, row: { ...prev, stage },
      ctx: { prisma: db, userId: "user", skip: new Set() } as unknown as TriggerCtx,
    });
    if (expectedStatus) {
      expect(db.account.update).toHaveBeenCalledWith({ where: { id: "account" }, data: expect.objectContaining({ clientStatus: expectedStatus }) });
    } else {
      expect(db.account.update).not.toHaveBeenCalled();
    }
  });
});

it("blocks conversion before creating records when an admin-required field is missing", async () => {
  db.lead.findUnique.mockResolvedValue({ id: "lead", status: "Working Lead", businessName: "Example", contactName: "Test", debts: [], calls: [], totalDebtEst: 10000, sfDataJson: JSON.stringify({ five9_Disposition__c: "Transferred", CloserLookup__c: "closer", Call_Transfer_Status__c: "Transferred", Call_Received_By_Lookup__c: "closer", Call_Received_Date__c: "2026-10-05" }) });
  db.pageLayout.findMany.mockResolvedValue([{ id: "record-fields:Lead:Converted", layout: { "lead-1": { columns: 2, fields: [{ id: "Email", hidden: false, span: 1, required: true }] } } }]);
  db.account.create.mockClear();
  await expect(convertLead("lead", { skipValidation: true })).rejects.toThrow("Email"); expect(db.account.create).not.toHaveBeenCalled();
});
