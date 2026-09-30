import { expect, it } from "vitest";
import { leadHealthResults, type LeadHealthCheckInput } from "@/lib/lead-health-check";
const base: LeadHealthCheckInput = { status: "Working Lead", businessName: "Test", firstName: "Test", lastName: "Lead", industry: "Other", totalDebt: 0, firstCreditorDebt: null, leadSource: "Web", isPaymentAmountPopulated: false, callDispositionPopulated: false };
const debtChecks = (input: LeadHealthCheckInput) => leadHealthResults(input).filter(r => ["debt-details", "minimum-debt"].includes(r.id));
it("uses saved creditor debts instead of stale imported totals", () => {
 expect(debtChecks({...base, debts: [{amount: 40000}, {amount: 100000}]}).every(r => r.ok)).toBe(true);
});
it("does not keep passing on old Salesforce values after the last debt is removed", () => {
 expect(debtChecks({...base, totalDebt: 140000, firstCreditorDebt: 40000, debts: []}).every(r => !r.ok)).toBe(true);
});
it("checks the minimum against the current saved total", () => {
 expect(debtChecks({...base, debts: [{amount: 29999}]}).find(r => r.id === "minimum-debt")?.ok).toBe(false);
 expect(debtChecks({...base, debts: [{amount: 30000}]}).find(r => r.id === "minimum-debt")?.ok).toBe(true);
});
