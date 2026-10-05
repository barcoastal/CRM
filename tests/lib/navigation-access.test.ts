import { describe, expect, it } from "vitest";
import { canViewNavigation } from "@/lib/navigation-access";

describe("CRM navigation reflects effective permissions", () => {
  it("shows a restricted opener only permitted workspaces", () => {
    const grants = ["Lead.View", "Call.Log"];
    expect(canViewNavigation("/leads", grants)).toBe(true);
    expect(canViewNavigation("/call-center", grants)).toBe(true);
    for (const href of ["/dashboard", "/accounts", "/opportunities", "/floor-manager", "/settings/app-log", "/integrations"])
      expect(canViewNavigation(href, grants)).toBe(false);
  });
  it("recognizes ViewAll, ModifyAll and team wide grants", () => {
    expect(canViewNavigation("/accounts", ["Account.ViewAll"])).toBe(true);
    expect(canViewNavigation("/accounts", ["Account.ModifyAll"])).toBe(true);
    expect(canViewNavigation("/integrations", ["Modify.AllData"])).toBe(true);
  });
});
