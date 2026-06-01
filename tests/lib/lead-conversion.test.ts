import { describe, it, expect } from "vitest";
import { splitContactName, defaultOpportunityName } from "../../src/lib/lead-conversion";

describe("splitContactName", () => {
  it("splits a typical two-part name", () => {
    expect(splitContactName("Bob Johnson")).toEqual({ firstName: "Bob", lastName: "Johnson" });
  });
  it("uses only firstName when there is no space", () => {
    expect(splitContactName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
  });
  it("treats everything after the first space as lastName", () => {
    expect(splitContactName("Bar Elezra Smith")).toEqual({
      firstName: "Bar",
      lastName: "Elezra Smith",
    });
  });
  it("trims surrounding whitespace", () => {
    expect(splitContactName("  Maria  Garcia  ")).toEqual({
      firstName: "Maria",
      lastName: "Garcia",
    });
  });
  it("returns empty strings for an empty input", () => {
    expect(splitContactName("")).toEqual({ firstName: "", lastName: "" });
    expect(splitContactName("   ")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("defaultOpportunityName", () => {
  it("formats an account name + a product label", () => {
    expect(defaultOpportunityName("Acme Construction LLC", "DEBT_SETTLEMENT")).toBe(
      "Acme Construction LLC — Debt Settlement",
    );
    expect(defaultOpportunityName("ABC Corp", "BUYOUT")).toBe("ABC Corp — Buyout");
    expect(defaultOpportunityName("XYZ Ltd", "RESTRUCTURE")).toBe("XYZ Ltd — Restructure");
    expect(defaultOpportunityName("123 Inc", "LIMITED_ASSET_PROTECTION")).toBe(
      "123 Inc — Limited Asset Protection",
    );
  });
});
