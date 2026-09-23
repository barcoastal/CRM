import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyLeadRouting } from "@/lib/automation/lead-routing";
import { caseApprovalEligible } from "@/lib/automation/case-policy";
import type { Lead } from "@/generated/prisma/client";
import type { TriggerCtx } from "@/lib/triggers/types";

const findFirst = vi.fn();
const ctx = { prisma: { user: { findFirst } }, userId: "actor", skip: new Set() } as unknown as TriggerCtx;
beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

describe("audited lead routing", () => {
  it("assigns eligible inbound leads to the mapped active owner", async () => {
    findFirst.mockResolvedValue({ id: "seth" });
    const next = { source: "Web", assignedToId: "old-owner" } as Partial<Lead> & Record<string, unknown>;
    await applyLeadRouting(next, undefined, ctx);
    expect(next.assignedToId).toBe("seth");
    expect(next.leadAssignmentDate).toBeInstanceOf(Date);
    expect(findFirst.mock.calls[0][0].where.isActive).toBe(true);
  });
  it("preserves an explicit owner if the mapped owner is unavailable", async () => {
    findFirst.mockResolvedValue(null);
    const next = { source: "Web", assignedToId: "existing" };
    await applyLeadRouting(next, undefined, ctx);
    expect(next.assignedToId).toBe("existing");
  });
  it("does not reroute edits, excluded sources, or disabled rules", async () => {
    await applyLeadRouting({ source: "Web" }, { sfDataJson: null } as Lead, ctx);
    await applyLeadRouting({ source: "Purchased List" }, undefined, ctx);
    vi.stubEnv("DISABLE_WEB_LEAD_ROUTING", "true");
    await applyLeadRouting({ source: "Web" }, undefined, ctx);
    expect(findFirst).not.toHaveBeenCalled();
  });
  it("derives agent location from the fronter custom country, preserving other fields", async () => {
    findFirst.mockResolvedValue({ userCountry: "Romania" });
    const next = { sfDataJson: JSON.stringify({ FronterLookup__c: "005-source" }) };
    await applyLeadRouting(next, { sfDataJson: '{"unrelated":123}' } as Lead, ctx);
    expect(JSON.parse(next.sfDataJson)).toEqual({ unrelated: 123, FronterLookup__c: "005-source", Agent_Location__c: "Romania" });
  });
  it("does not overwrite the location on unrelated edits", async () => {
    const next = { sfDataJson: '{"unrelated":2}' };
    await applyLeadRouting(next, { sfDataJson: '{"FronterLookup__c":"005-source","Agent_Location__c":"US"}' } as Lead, ctx);
    expect(JSON.parse(next.sfDataJson).Agent_Location__c).toBe("US");
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("live case approval entry criteria", () => {
  it("accepts only customer support and the audited request types", () => {
    expect(caseApprovalEligible({ recordType: "SUPPORT", type: "Refund" })).toBe(true);
    expect(caseApprovalEligible({ recordType: "SUPPORT", type: "General Question" })).toBe(false);
    expect(caseApprovalEligible({ recordType: "BANK_UPDATE", type: "Refund" })).toBe(false);
    expect(caseApprovalEligible({ recordType: "SUPPORT" })).toBe(false);
  });
  it("supports imported Type and existing subtype records", () => {
    expect(caseApprovalEligible({ recordType: "SUPPORT", sfDataJson: '{"Type":"Wire Confirmation"}' })).toBe(true);
    expect(caseApprovalEligible({ recordType: "SKIP_PAYMENT" })).toBe(true);
  });
});
