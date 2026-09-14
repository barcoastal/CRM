import { describe, expect, it } from "vitest";
import { opportunityContactIdentity } from "../../src/lib/sf-sync/opportunity-contact";

describe("Salesforce opportunity contact identity", () => {
  const contact = { id: "crm-contact", birthdate: new Date("2000-02-29T00:00:00Z"), ssn: "000000001" };
  const contacts = new Map([["sf-contact", contact]]);
  it("links the explicit contact and refreshes the fields used by the record page", () => {
    expect(opportunityContactIdentity("sf-contact", contacts)).toEqual({
      primaryContactId: contact.id, dateOfBirth: contact.birthdate, contactSsn: contact.ssn,
    });
  });
  it("does not erase local identity when Salesforce has no contact relationship", () => {
    expect(opportunityContactIdentity("", contacts)).toEqual({});
  });
  it("rejects incomplete exports and unresolved contacts rather than attaching another person", () => {
    expect(() => opportunityContactIdentity(undefined, contacts)).toThrow("missing ContactId");
    expect(() => opportunityContactIdentity("other", contacts)).toThrow("sync contacts first");
  });
  it("clears stale identity from a previous person when the explicit contact has blank fields", () => {
    expect(opportunityContactIdentity("blank", new Map([["blank", { id: "new-contact", birthdate: null, ssn: null }]])))
      .toEqual({ primaryContactId: "new-contact", dateOfBirth: null, contactSsn: null });
  });
});
