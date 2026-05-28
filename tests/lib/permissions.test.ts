import { describe, it, expect } from "vitest";
import { hasPermission, requirePermission, PermissionDeniedError, isPermissionKey } from "../../src/lib/permissions";

describe("hasPermission", () => {
  it("returns true for an exact-key match", () => {
    expect(hasPermission(["Lead.Edit"], "Lead.Edit")).toBe(true);
  });

  it("returns false when the key is missing", () => {
    expect(hasPermission(["Lead.View"], "Lead.Edit")).toBe(false);
  });

  it("returns false for an empty grant set", () => {
    expect(hasPermission([], "Lead.View")).toBe(false);
  });

  it("Modify.AllData is a global override", () => {
    expect(hasPermission(["Modify.AllData"], "Anything.Goes")).toBe(true);
    expect(hasPermission(["Modify.AllData"], "User.Deactivate")).toBe(true);
  });

  it("ViewAll on an entity implies View on that entity", () => {
    expect(hasPermission(["Lead.ViewAll"], "Lead.View")).toBe(true);
  });

  it("ViewAll on one entity does NOT imply View on another", () => {
    expect(hasPermission(["Lead.ViewAll"], "Opportunity.View")).toBe(false);
  });

  it("ModifyAll on an entity implies View / Edit / Delete on the same entity", () => {
    expect(hasPermission(["Opportunity.ModifyAll"], "Opportunity.View")).toBe(true);
    expect(hasPermission(["Opportunity.ModifyAll"], "Opportunity.Edit")).toBe(true);
    expect(hasPermission(["Opportunity.ModifyAll"], "Opportunity.Delete")).toBe(true);
  });

  it("ModifyAll does NOT imply Approve or other special actions", () => {
    expect(hasPermission(["Settlement.ModifyAll"], "Settlement.Approve")).toBe(false);
  });

  it("ignores malformed required keys", () => {
    expect(hasPermission(["Modify.AllData"], "weirdkey")).toBe(true); // Modify.AllData still wins
    expect(hasPermission(["Lead.ViewAll"], "weirdkey")).toBe(false);
  });
});

describe("requirePermission", () => {
  it("throws PermissionDeniedError when missing", () => {
    expect(() => requirePermission([], "Lead.Edit")).toThrow(PermissionDeniedError);
  });

  it("does not throw when granted", () => {
    expect(() => requirePermission(["Lead.Edit"], "Lead.Edit")).not.toThrow();
  });

  it("includes the required key in the error", () => {
    try {
      requirePermission([], "Reports.Export");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PermissionDeniedError);
      expect((e as PermissionDeniedError).required).toBe("Reports.Export");
      expect((e as Error).message).toContain("Reports.Export");
    }
  });
});

describe("isPermissionKey", () => {
  it("recognizes catalogued keys", () => {
    expect(isPermissionKey("Lead.Edit")).toBe(true);
    expect(isPermissionKey("Modify.AllData")).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(isPermissionKey("Lead.Teleport")).toBe(false);
    expect(isPermissionKey("")).toBe(false);
  });
});
