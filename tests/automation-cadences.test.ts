import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Opportunity } from "@/generated/prisma/client";
const mocks = vi.hoisted(() => ({ cancel: vi.fn(), account: vi.fn(), cadence: vi.fn(), user: vi.fn(), log: vi.fn(), enroll: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { cadenceEnrollment: { updateMany: mocks.cancel }, account: { findUnique: mocks.account }, callCadence: { findUnique: mocks.cadence }, user: { findFirst: mocks.user }, applicationLog: { create: mocks.log } } }));
vi.mock("@/lib/cadences", () => ({ enrollInCadence: mocks.enroll }));
import { syncOpportunityCadences } from "@/lib/automation/opportunity-cadences";
const base = { id: "opp", accountId: "account", stage: "New", welcomeCallScheduled: null } as Opportunity;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ENABLE_OPPORTUNITY_CADENCES", "true");
  mocks.account.mockResolvedValue({ primaryContactId: "contact", ownerId: "account-owner" });
  mocks.cadence.mockImplementation(({ where }) => ({ id: where.name, isActive: true, steps: [{ id: "step1" }] }));
  mocks.user.mockResolvedValue({ id: "manager" });
});
afterEach(() => vi.unstubAllEnvs());
describe("opportunity cadence entry", () => {
  it("does not enroll or change existing reminders until verified cadences are enabled", async () => {
    vi.stubEnv("ENABLE_OPPORTUNITY_CADENCES", "false");
    await syncOpportunityCadences({ ...base, stage: "Closed Won First Payment Pending", welcomeCallScheduled: new Date() }, base);
    expect(mocks.account).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("schedules welcome work one day before the call for the account contact and owner", async () => {
    const when = new Date("2026-10-02T14:00:00Z");
    await syncOpportunityCadences({ ...base, welcomeCallScheduled: when }, base);
    expect(mocks.enroll).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      cadenceId: "Welcome Call", contactId: "contact", enrolledById: "account-owner", opportunityId: "opp",
      startAt: new Date("2026-10-01T14:00:00Z"), scheduledFor: when, automationKey: "welcome-call:opp",
    }));
  });
  it("cancels a pending reminder when an appointment is cleared", async () => {
    await syncOpportunityCadences(base, { ...base, welcomeCallScheduled: new Date() });
    expect(mocks.cancel).toHaveBeenCalledOnce(); expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("does nothing on unrelated updates", async () => {
    await syncOpportunityCadences({ ...base, notes: "Changed" }, base);
    expect(mocks.account).not.toHaveBeenCalled(); expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("enters the contract cadence only on the audited stage transition", async () => {
    const pending = { ...base, stage: "Closed Won First Payment Pending" };
    await syncOpportunityCadences(pending, base);
    expect(mocks.enroll).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ cadenceId: "Contract Signed", enrolledById: "manager", automationKey: "contract-signed:opp" }));
    mocks.enroll.mockClear(); await syncOpportunityCadences(pending, pending);
    await syncOpportunityCadences({ ...base, stage: "Contract Signed" }, base);
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("requires an account primary contact", async () => {
    mocks.account.mockResolvedValue({ primaryContactId: null });
    await syncOpportunityCadences({ ...base, stage: "Closed Won First Payment Pending" }, base);
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("reports missing cadence steps instead of inventing a sequence", async () => {
    mocks.cadence.mockResolvedValue({ id: "cadence", isActive: true, steps: [] });
    await syncOpportunityCadences({ ...base, stage: "Closed Won First Payment Pending" }, base);
    expect(mocks.enroll).not.toHaveBeenCalled(); expect(mocks.log).toHaveBeenCalledOnce();
  });
});
