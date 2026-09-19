import { describe, expect, it } from "vitest";
import { canRevealSsn, isSsnField, maskSsn, redactSsn } from "../../src/lib/ssn-privacy";

describe("SSN privacy boundaries", () => {
  it("does not mistake businessName or className for SSN fields", () => {
    for (const key of ["businessName", "className", "businessNumber"]) expect(isSsnField(key)).toBe(false);
    for (const key of ["ssn", "contactSsn", "SSN__c", "SSN_Encrypted__c", "SSN__pc", "account.SSN__c", "socialSecurityNumber"]) expect(isSsnField(key)).toBe(true);
    expect(redactSsn({ businessName: "Example LLC", className: "text-xs" })).toEqual({ businessName: "Example LLC", className: "text-xs" });
  });
  it("shows only four digits, including leading zeroes", () => {
    expect(maskSsn("012-34-0001")).toBe("XXX-XX-0001");
    expect(maskSsn("XXX-XX-0001")).toBe("XXX-XX-0001");
    expect(maskSsn("12")).toBe("XXX-XX-XXXX");
    expect(maskSsn(null)).toBeNull();
  });
  it("grants reveal only to administrator roles", () => {
    expect(canRevealSsn("ADMIN")).toBe(true);
    expect(canRevealSsn("SUPER_ADMIN")).toBe(true);
    for (const role of ["MANAGER", "CLOSER", "AGENT", "admin", undefined]) expect(canRevealSsn(role)).toBe(false);
  });
  it("redacts nested records, snapshots and audit history without mutating source data", () => {
    const ssn = "012-34-5678";
    const source = { ssn, primaryContact: { ssn }, contactSsn: ssn, sfDataJson: JSON.stringify({ SSN__c: ssn, SSN_Encrypted__c: ssn, Phone: "5551234567" }), history: [{ field: "SSN", oldValue: ssn, newValue: ssn }], audit: { before: { SSN__c: ssn }, after: { contactSsn: ssn } } };
    const result = redactSsn(source);
    expect(JSON.stringify(result)).not.toContain(ssn);
    expect(result.history[0].oldValue).toBe("XXX-XX-5678");
    expect(JSON.parse(result.sfDataJson).Phone).toBe("5551234567");
    expect(source.ssn).toBe(ssn);
  });
  it("preserves dates and non-SSN fields and fails closed for malformed snapshots", () => {
    const date = new Date("2000-01-01Z");
    expect(redactSsn({ birthdate: date, ein: "12-3456789", sfDataJson: "broken" })).toEqual({ birthdate: date, ein: "12-3456789", sfDataJson: null });
  });
});

it('preserves valid React elements while masking their sensitive props',async()=>{
 const {createElement,isValidElement}=await import('react');
 const element=createElement('div',{'data-testid':'safe',ssn:'123456789'} as Record<string,unknown>);
 const redacted=redactSsn(element);
 expect(isValidElement(redacted)).toBe(true);
 expect((redacted.props as Record<string,unknown>).ssn).toBe('XXX-XX-6789');
 expect(redacted.type).toBe('div');
});
