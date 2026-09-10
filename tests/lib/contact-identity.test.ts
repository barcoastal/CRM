import { describe, expect, it } from "vitest";
import { contactIdentity } from "../../src/lib/sf-sync/contact-identity";

describe("Salesforce contact identity mapping", () => {
  it("preserves leading zeroes and date-only birthdays", () => {
    const result = contactIdentity({ Birthdate: "2000-02-29", SSN__c: "000000001" });
    expect(result.ssn).toBe("000000001");
    expect(result.birthdate?.toISOString()).toBe("2000-02-29T00:00:00.000Z");
  });
  it("clears fields when Salesforce is blank", () => {
    expect(contactIdentity({ Birthdate: "", SSN__c: "" })).toEqual({ birthdate: null, ssn: null });
  });
  it("rejects missing columns instead of clearing stored values", () => {
    expect(() => contactIdentity({ Birthdate: "" })).toThrow("missing required field");
    expect(() => contactIdentity({ SSN__c: "" })).toThrow("missing required field");
  });
  it("rejects invalid birthdays without including identity data in errors", () => {
    expect(() => contactIdentity({ Birthdate: "2001-02-29", SSN__c: "000000001" }))
      .toThrow("Contact export contains an invalid Birthdate");
  });
});
