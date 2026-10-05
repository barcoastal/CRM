import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Opportunity } from "@/generated/prisma/client";
import type { TriggerCtx } from "@/lib/triggers/types";

const db = vi.hoisted(() => ({
  lead: { findUnique: vi.fn(), update: vi.fn() },
  account: { create: vi.fn(), update: vi.fn() },
  contact: { create: vi.fn() },
  accountContactRelation: { create: vi.fn() },
  opportunity: { create: vi.fn() },
  opportunityHistory: { create: vi.fn() },
  task: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/audit", () => ({ auditWrite: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/marketing/postback", () => ({ firePostbackEvent: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/automation/opportunity-cadences", () => ({ syncOpportunityCadences: vi.fn() }));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/validation-rules/evaluator", () => ({ runRulesFor: vi.fn() }));
import { convertLead } from "@/lib/lead-conversion";
import { opportunityTrigger } from "@/lib/triggers/opportunity-trigger";

describe("conversion account lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (fn) => fn(db));
    db.lead.findUnique.mockResolvedValue({ id: "lead", businessName: "Example", contactName: "Test Person", totalDebtEst: 10000, debts: [], calls: [] });
    db.account.create.mockResolvedValue({ id: "account", name: "Example" });
    db.contact.create.mockResolvedValue({ id: "contact" });
    db.opportunity.create.mockResolvedValue({ id: "opportunity" });
    db.account.update.mockResolvedValue({});
  });

  it("creates an inactive account and returns the new opportunity", async () => {
    const result = await convertLead("lead");
    expect(db.account.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ clientStatus: "Inactive" }) }));
    expect(result.opportunityId).toBe("opportunity");
  });

  it("keeps an account inactive when opportunity creation is skipped", async () => {
    const result = await convertLead("lead", { doNotCreateOpportunity: true });
    expect(db.account.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ clientStatus: "Inactive" }) }));
    expect(result.opportunityId).toBeNull();
    expect(db.opportunity.create).not.toHaveBeenCalled();
  });

  it.each([
    ["Working Opportunity", null],
    ["Closed Won First Payment Pending", "Waiting First Payment"],
    ["Closed Won - First Payment Completed", "Active"],
  ])("handles stage %s without premature activation", async (stage, expectedStatus) => {
    const prev = { id: "opportunity", accountId: "account", stage: "New" } as Opportunity;
    await opportunityTrigger.afterUpdate!({
      prev, row: { ...prev, stage },
      ctx: { prisma: db, userId: "user", skip: new Set() } as unknown as TriggerCtx,
    });
    if (expectedStatus) {
      expect(db.account.update).toHaveBeenCalledWith({ where: { id: "account" }, data: expect.objectContaining({ clientStatus: expectedStatus }) });
    } else {
      expect(db.account.update).not.toHaveBeenCalled();
    }
  });
});
