import { describe, it, expect } from "vitest";
import {
  isLeadRecordType,
  isAccountRecordType,
  isOpportunityRecordType,
  isArchivedLead,
  defaultAccountRecordTypeForLead,
} from "../../src/lib/record-types";

describe("record-type validators", () => {
  it("isLeadRecordType accepts known values", () => {
    expect(isLeadRecordType("WEB")).toBe(true);
    expect(isLeadRecordType("ARCHIVED_LIST")).toBe(true);
  });
  it("isLeadRecordType rejects unknown values", () => {
    expect(isLeadRecordType("EMAIL")).toBe(false);
    expect(isLeadRecordType("")).toBe(false);
  });
  it("isAccountRecordType accepts known values", () => {
    expect(isAccountRecordType("CLIENT")).toBe(true);
    expect(isAccountRecordType("CREDITOR")).toBe(true);
  });
  it("isOpportunityRecordType accepts the four products", () => {
    expect(isOpportunityRecordType("DEBT_SETTLEMENT")).toBe(true);
    expect(isOpportunityRecordType("BUYOUT")).toBe(true);
    expect(isOpportunityRecordType("RESTRUCTURE")).toBe(true);
    expect(isOpportunityRecordType("LIMITED_ASSET_PROTECTION")).toBe(true);
  });
  it("isOpportunityRecordType rejects unknown values", () => {
    expect(isOpportunityRecordType("UPSELL")).toBe(false);
  });
});

describe("isArchivedLead", () => {
  it("returns true for archived variants", () => {
    expect(isArchivedLead("ARCHIVED_WEB")).toBe(true);
    expect(isArchivedLead("ARCHIVED_DIRECT_MAIL")).toBe(true);
    expect(isArchivedLead("ARCHIVED_LIST")).toBe(true);
  });
  it("returns false for active variants", () => {
    expect(isArchivedLead("WEB")).toBe(false);
    expect(isArchivedLead("BUSINESS")).toBe(false);
  });
});

describe("defaultAccountRecordTypeForLead", () => {
  it("uses PERSON_ACCOUNT when there's no business name", () => {
    expect(
      defaultAccountRecordTypeForLead({ leadRecordType: "WEB", hasBusinessName: false }),
    ).toBe("PERSON_ACCOUNT");
  });
  it("uses BUSINESS_ACCOUNT when there is a business name", () => {
    expect(
      defaultAccountRecordTypeForLead({ leadRecordType: "WEB", hasBusinessName: true }),
    ).toBe("BUSINESS_ACCOUNT");
    expect(
      defaultAccountRecordTypeForLead({ leadRecordType: "BUSINESS", hasBusinessName: true }),
    ).toBe("BUSINESS_ACCOUNT");
  });
});
