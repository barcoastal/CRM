import { describe, it, expect } from "vitest";
import { ownerFieldFor, buildFromAddress } from "@/lib/flow/email-node";

describe("ownerFieldFor", () => {
  it("maps each entity to its owner column", () => {
    expect(ownerFieldFor("Lead")).toBe("assignedToId");
    expect(ownerFieldFor("Opportunity")).toBe("assignedToId");
    expect(ownerFieldFor("Contact")).toBe("ownerId");
    expect(ownerFieldFor("Account")).toBe("ownerId");
    expect(ownerFieldFor("Case")).toBe("ownerId");
    expect(ownerFieldFor("Task")).toBeNull();
  });
});

describe("buildFromAddress", () => {
  it("formats a quoted display name with the mailbox", () => {
    expect(buildFromAddress({ name: 'Bar "The Man" Elezra', mailboxAddress: "bar@x.com", email: "b@y.com" }))
      .toBe('"Bar \\"The Man\\" Elezra" <bar@x.com>');
  });
  it("falls back to login email when no mailbox is set", () => {
    expect(buildFromAddress({ name: "Ann", mailboxAddress: null, email: "ann@y.com" }))
      .toBe('"Ann" <ann@y.com>');
  });
  it("returns null when the user has no usable address", () => {
    expect(buildFromAddress(null)).toBeNull();
  });
});
