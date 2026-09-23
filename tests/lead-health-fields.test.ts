import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/validation-rules/evaluator", () => ({ runRulesFor: vi.fn().mockResolvedValue({ ok: true }) }));
import { leadTrigger } from "@/lib/triggers/lead-trigger";
import type { TriggerCtx } from "@/lib/triggers/types";
import type { Lead } from "@/generated/prisma/client";
import { syncLeadHealthFields, splitLeadName } from "@/lib/lead-health-fields";
import { leadHealthResults } from "@/lib/lead-health-check";

const previous = (sf: Record<string, unknown>) => ({ contactName: "Mary Jane Watson", sfDataJson: JSON.stringify(sf) }) as Lead;
describe("health results after CRM edits", () => {
  it("runs field and payment recalculation together through the actual save hook", async () => {
    const next = { businessName: "Updated company", sfDataJson: JSON.stringify({ Creditor_1_Total_Debt__c: 30000, Creditor_1_Payment__c: 0 }) };
    await leadTrigger.beforeUpdate!({ next, prev: previous({ Company: "Old", Creditor_1_Total_Debt__c: 20000 }), ctx: { prisma: {}, userId: null, skip: new Set() } as TriggerCtx });
    expect(JSON.parse(next.sfDataJson)).toMatchObject({ Company: "Updated company", Current_Total_Debt_Amount__c: 30000, Is_Payment_Amount_Populated__c: false });
  });
  it("updates company/source/industry evidence for normal and bulk typed saves", () => {
    const next = { businessName: "Updated", source: "Google", industry: "Trucking", sfDataJson: "{}" };
    syncLeadHealthFields(next, previous({ Company: "Old", LeadSource: null, Other__c: 7 }));
    expect(JSON.parse(next.sfDataJson)).toMatchObject({ Company: "Updated", LeadSource: "Google", Industry: "Trucking", Other__c: 7 });
  });
  it("keeps individual name edits and the displayed name consistent without guessing compound names", () => {
    const next: Record<string, unknown> = { sfDataJson: JSON.stringify({ FirstName: "Mary Jane", LastName: "Smith" }) };
    syncLeadHealthFields(next, previous({ FirstName: "Mary Jane", LastName: "Watson" }));
    expect(next.contactName).toBe("Mary Jane Smith");
    expect(JSON.parse(String(next.sfDataJson)).FirstName).toBe("Mary Jane");
  });
  it("clears source fields without writing null into required CRM columns", () => {
    const next: Record<string, unknown> = { sfDataJson: JSON.stringify({ Company: null, LeadSource: null }) };
    syncLeadHealthFields(next, previous({ Company: "Old", LeadSource: "Web" }));
    expect(next.businessName).toBe("");
    expect(next.source).toBe("");
    expect(JSON.parse(String(next.sfDataJson)).LeadSource).toBeNull();
  });
  it("updates health name fields when the CRM full name is changed", () => {
    const next = { contactName: "Jane Smith", sfDataJson: "{}" };
    syncLeadHealthFields(next, previous({ FirstName: null, LastName: "New Inbound" }));
    expect(JSON.parse(next.sfDataJson)).toMatchObject({ FirstName: "Jane", LastName: "Smith" });
  });
  it("recalculates all ten balances across the inclusive minimum and when cleared", () => {
    const sf = { Creditor_1_Total_Debt__c: 20000, Creditor_10_Total_Debt__c: 9999, Current_Total_Debt_Amount__c: 29999 };
    const next = { sfDataJson: JSON.stringify({ Creditor_10_Total_Debt__c: 10000 }) };
    syncLeadHealthFields(next, previous(sf));
    const total = JSON.parse(next.sfDataJson).Current_Total_Debt_Amount__c;
    expect(total).toBe(30000);
    const result = leadHealthResults({ status: "Working Lead", businessName: "A", firstName: "A", lastName: "B", industry: "A", totalDebt: total, leadSource: "Web", firstCreditorDebt: 20000, isPaymentAmountPopulated: true, callDispositionPopulated: true });
    expect(result.find(row => row.id === "minimum-debt")?.ok).toBe(true);
    const cleared = { sfDataJson: JSON.stringify({ Creditor_1_Total_Debt__c: null, Creditor_10_Total_Debt__c: null }) };
    syncLeadHealthFields(cleared, previous(JSON.parse(next.sfDataJson)));
    expect(JSON.parse(cleared.sfDataJson).Current_Total_Debt_Amount__c).toBe(0);
  });
  it("does not substitute estimated debt or erase an imported formula on unrelated edits", () => {
    const next = { totalDebtEst: 90000, sfDataJson: "{}" };
    syncLeadHealthFields(next, previous({ Current_Total_Debt_Amount__c: 12000 }));
    expect(JSON.parse(next.sfDataJson).Current_Total_Debt_Amount__c).toBe(12000);
  });
  it("preserves the New Inbound placeholder as the last name", () => {
    expect(splitLeadName("New Inbound")).toEqual({ FirstName: null, LastName: "New Inbound" });
  });
});
