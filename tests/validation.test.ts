import { describe, it, expect } from "vitest";
import { validateLeadPatch, LEAD_RULE_COUNT } from "@/lib/validation/lead-validation";
import { validateOppPatch, OPP_RULE_COUNT } from "@/lib/validation/opp-validation";
import { validateAccountPatch, ACCOUNT_RULE_COUNT } from "@/lib/validation/account-validation";
import { validateContactPatch, CONTACT_RULE_COUNT } from "@/lib/validation/contact-validation";

describe("Lead validation", () => {
  const base = {
    id: "x",
    status: "New",
    phone: "555-1111",
    email: null,
    contactName: "John",
    businessName: "Acme",
  };

  it("blocks transitioning out of Converted", () => {
    const errors = validateLeadPatch({ ...base, status: "Converted" }, { status: "Working Lead" });
    expect(errors).toContain("A converted Lead cannot change status.");
  });

  it("rejects malformed email", () => {
    const errors = validateLeadPatch(base, { email: "not-an-email" });
    expect(errors).toContain("Email must be a valid email address.");
  });

  it("requires phone to move to Working Lead", () => {
    const errors = validateLeadPatch({ ...base, phone: null }, { status: "Working Lead" });
    expect(errors).toContain("Phone is required before a Lead can move to Working Lead.");
  });

  it("requires name to archive", () => {
    const errors = validateLeadPatch(
      { ...base, contactName: null, businessName: null },
      { status: "Archive Disposition" },
    );
    expect(errors).toContain("Contact Name or Business Name is required to archive a Lead.");
  });

  it("allows New -> Working Lead with valid data", () => {
    const errors = validateLeadPatch(base, { status: "Working Lead" });
    expect(errors).toEqual([]);
  });
});

describe("Opportunity validation", () => {
  it("blocks reopening Closed Lost", () => {
    const errors = validateOppPatch({ id: "x", stage: "Closed Lost" }, { stage: "Working Opportunity" });
    expect(errors[0]).toMatch(/terminal/);
  });

  it("blocks account reparenting", () => {
    const errors = validateOppPatch(
      { id: "x", stage: "Working Opportunity", accountId: "a" },
      { accountId: "b" },
    );
    expect(errors).toContain("Opportunity cannot be reparented to a different Account.");
  });

  it("requires Total Debt > 0", () => {
    const errors = validateOppPatch({ id: "x", stage: "Working Opportunity" }, { totalDebt: 0 });
    expect(errors).toContain("Total Debt must be greater than zero.");
  });

  it("enforces Program Length Approval matrix", () => {
    const errors = validateOppPatch(
      { id: "x", stage: "Working Opportunity", totalDebt: 60000 },
      { Payment_Term__c: "6" },
    );
    expect(errors[0]).toMatch(/Closer profile/);
  });
});

describe("Account validation", () => {
  it("blocks Cancelled -> Active", () => {
    const errors = validateAccountPatch({ id: "x", stage: "Cancelled" }, { stage: "Active" });
    expect(errors[0]).toMatch(/terminal/);
  });

  it("requires non-empty Name", () => {
    const errors = validateAccountPatch({ id: "x", stage: "Active", name: "Acme" }, { name: "" });
    expect(errors).toContain("Account Name is required.");
  });

  it("blocks self-parent", () => {
    const errors = validateAccountPatch({ id: "x", stage: "Active" }, { parentAccountId: "x" });
    expect(errors).toContain("An Account cannot be its own parent.");
  });
});

describe("Contact validation", () => {
  it("requires Last Name", () => {
    const errors = validateContactPatch({ id: "x", lastName: "Doe" }, { lastName: "" });
    expect(errors).toContain("Last Name is required.");
  });

  it("blocks self primary account", () => {
    const errors = validateContactPatch({ id: "x", lastName: "Doe" }, { primaryAccountId: "x" });
    expect(errors).toContain("Primary Account cannot be the Contact itself.");
  });

  it("blocks malformed email", () => {
    const errors = validateContactPatch({ id: "x", lastName: "Doe" }, { email: "nope" });
    expect(errors).toContain("Email must be a valid email address.");
  });
});

describe("rule counts", () => {
  it("totals 18 rules", () => {
    expect(LEAD_RULE_COUNT + OPP_RULE_COUNT + ACCOUNT_RULE_COUNT + CONTACT_RULE_COUNT).toBe(18);
  });
});
