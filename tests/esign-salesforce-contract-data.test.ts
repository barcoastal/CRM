import { describe, it, expect } from "vitest";
import { contractFixture } from "./fixtures/salesforce-contract";
import {
  contractSchema,
  salesforceMergeData,
} from "@/lib/esign/salesforce/contract-data";
const snapshot = {
  accountName: "TEST - Pilot",
  signerName: "Test Signer",
  signerEmail: "bar@coastaldebt.com",
  street: "123 Test St",
  city: "Fort Lauderdale",
  state: "Florida",
  postalCode: "33309",
  country: "United States",
  processor: "RAM" as const,
  totalDebt: 150000,
  contract: contractFixture,
};
describe("Salesforce saved contract data", () => {
  it("preserves the exact saved rows and values rather than generating a six month sample schedule", () => {
    const data = salesforceMergeData(
      snapshot,
      new Date("2026-10-02T00:30:00Z"),
    );
    expect(data.Schedule).toHaveLength(2);
    expect(data.TotalWithFees).toBe("$105,960.00");
    expect(data.EstimatedSavings).toBe("$44,040.00");
    expect(data.FirstPaymentAmount).toBe("$53,405.00");
    expect(data.SettlementPercent).toBe("40");
    expect(data.TotalProgramPercentDisplay).toBe("70%");
    expect(data.ProgramFeePercentDisplay).toBe("20%");
    expect(data.ProcessorName).toBe("RAM");
    expect(data.ContactDOB).toBe("1/1/1990");
    expect(data.Creditors).toEqual([
      {
        CreditorName: "TEST Creditor",
        Balance: "$150,000.00",
        AccountNumber: "TEST-001",
      },
    ]);
    expect(data.BankAccountNumber).toBe("000123456789");
    expect(data.TodayDate).toBe("10/2/2026");
  });
  it("rejects each independent monetary mismatch", () => {
    for (const mutate of [
      (c: typeof contractFixture) => {
        c.debts[0].balance -= 1;
      },
      (c: typeof contractFixture) => {
        c.drafts[0].amount += 1;
      },
      (c: typeof contractFixture) => {
        c.plan.totalDraft += 1;
      },
      (c: typeof contractFixture) => {
        c.plan.totalRetainer += 1;
      },
      (c: typeof contractFixture) => {
        c.debitSchedule[0].amount += 1;
      },
      (c: typeof contractFixture) => {
        c.debitSchedule[0].date = "2026-10-10";
      },
      (c: typeof contractFixture) => {
        c.debitSchedule[0].count = 2;
      },
    ]) {
      const c = structuredClone(contractFixture);
      mutate(c);
      expect(contractSchema.safeParse(c).success).toBe(false);
    }
  });
  it("rejects missing data, masked tax ids and unknown legal/processor selections", () => {
    for (const patch of [
      { drafts: [] },
      { debts: [] },
      { debitSchedule: [] },
      { taxId: "XXX-XX-1234" },
      { legalNetwork: "Unknown" },
      { plan: { ...contractFixture.plan, termMonths: undefined } },
    ])
      expect(
        contractSchema.safeParse({ ...contractFixture, ...patch }).success,
      ).toBe(false);
  });
  it("blocks a quote whose current debt differs from the saved plan", () =>
    expect(() =>
      salesforceMergeData({ ...snapshot, totalDebt: 160000 }),
    ).toThrow(/Recalculate/));
});

import { salesforcePacketPlan } from "@/lib/esign/salesforce/contract-data";
import { fillDocxTemplate } from "@/lib/contracts/docx-merge";
import { readFileSync } from "node:fs";
import PizZip from "pizzip";
it("routes all processor/legal combinations from Salesforce and respects the addendum flag", () => {
  for (const processor of ["SAS", "RAM"] as const)
    for (const legalNetwork of ["Citadel", "Victory Legal Plan"] as const)
      for (const includeAddendum of [true, false]) {
        const plan = salesforcePacketPlan({
          processor,
          includeAddendum,
          contract: { ...contractFixture, legalNetwork },
        });
        expect(plan.categories).toEqual([
          "COASTAL",
          ...(includeAddendum ? ["ADDENDUM"] : []),
          `PROCESSOR_${processor}`,
          legalNetwork === "Citadel" ? "LEGAL_CITADEL" : "LEGAL_VICTORY",
        ]);
      }
});
it("fills all bundled processor and legal templates without unmapped tokens", () => {
  const data = salesforceMergeData(snapshot, new Date("2026-10-02T12:00:00Z"));
  for (const name of [
    "PROCESSOR_SAS",
    "PROCESSOR_RAM",
    "LEGAL_CITADEL",
    "LEGAL_VICTORY",
  ]) {
    const filled = fillDocxTemplate(
      readFileSync(`docs/contract-templates/${name}.docx`),
      data,
      true,
    );
    const text = new PizZip(filled).file("word/document.xml")!.asText();
    expect(text).not.toContain("{{");
    expect(text).toContain(
      name.startsWith("LEGAL") ? "TEST - Pilot" : "000123456789",
    );
  }
});
