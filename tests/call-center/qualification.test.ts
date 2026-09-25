import { describe, it, expect } from "vitest";
import {
  debtTotal,
  leadProvenance,
  qualificationSchema,
} from "@/lib/call-center/qualification";
describe("lender totals and Salesforce provenance", () => {
  it("adds currency in cents", () => {
    expect(debtTotal([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
  });
  it("rejects duplicate debt IDs and removing a retained row", () => {
    const row = { key: "a", id: "debt", creditorName: "Bank", amount: 123 };
    expect(
      qualificationSchema.safeParse({
        id: "call",
        debts: [row, { ...row, key: "b" }],
        notes: "Confirmed",
      }).success,
    ).toBe(false);
    expect(
      qualificationSchema.safeParse({
        id: "call",
        debts: [row],
        removedDebtIds: ["debt"],
        notes: "Confirmed",
      }).success,
    ).toBe(false);
  });
  it("uses Salesforce LeadSource and Brand__c without exposing its raw snapshot", () => {
    expect(
      leadProvenance({
        source: "WEB",
        brand: null,
        sfId: "sf-id",
        sfDataJson: JSON.stringify({
          LeadSource: "Google Ads",
          Brand__c: "Coastal Debt",
          Private_Field__c: "private",
        }),
      }),
    ).toEqual({ source: "Google Ads", brand: "Coastal Debt" });
  });
  it.each(["not json", "null", "{}"])(
    "keeps canonical values when the snapshot is missing or invalid: %s",
    (sfDataJson) => {
      expect(
        leadProvenance({
          source: "Referral",
          brand: "BDI",
          sfId: "sf-id",
          sfDataJson,
        }),
      ).toEqual({ source: "Referral", brand: "BDI" });
    },
  );
});
