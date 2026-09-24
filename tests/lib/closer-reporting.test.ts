import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const mocks = vi.hoisted(() => ({ users: vi.fn(), query: vi.fn(), targets: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: mocks.users }, $queryRaw: mocks.query,
  closerScoreboardTarget: { findMany: mocks.targets } } }));
vi.mock("@/lib/five9/supervisor-feed", () => ({ supervisorFeed: { getStateFor: () => ({ state: "READY" }) } }));
import { monthlyScoreboard } from "@/lib/scoreboard";
import { closerStats, closerDashboard, easternBoundaries } from "@/lib/closer-tiers";
import { totalScoreboard } from "@/lib/scoreboard-shared";

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-24T12:00Z"));
  mocks.users.mockResolvedValue([
    { id: "active", name: "Active", isActive: true, closerTier: 1 },
    { id: "former", name: "Former", isActive: false, closerTier: 1 },
    { id: "idle", name: "Idle", isActive: false, closerTier: null },
    { id: "zero", name: "Zero", isActive: true, closerTier: 2 },
  ]);
  mocks.targets.mockResolvedValue([]);
  mocks.query.mockResolvedValue([
    { userId: "active", transfers: 10, transferDebt: 500000, contractsOut: 2, signed: 4, grossDebt: 350000, canceled: 1, canceledDebt: 50000, won: 2, wonDebt: 200000, paid: 1, paidDebt: 100000 },
    { userId: "former", transfers: 1, transferDebt: 50000, contractsOut: 0, signed: 1, grossDebt: 50000, canceled: 0, canceledDebt: 0, won: 1, wonDebt: 50000, paid: 0, paidDebt: 0 },
  ]);
});
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("consistent closer reporting", () => {
  it("uses the same stored Closed Won debt on TV, performance, and the live floor", async () => {
    const tv = await monthlyScoreboard("2026-09");
    const floor = await closerDashboard(Date.parse("2026-09-01T04:00Z"), Date.now());
    const live = await closerStats();
    expect(tv.map(r => r.userId).sort()).toEqual(["active", "former", "zero"]);
    for (const row of tv) {
      expect(floor.find(r => r.id === row.userId)?.closedDebt).toBe(row.wonDebt);
      expect(live.find(r => r.id === row.userId)?.debtClosed).toBe(row.wonDebt);
    }
    expect(totalScoreboard(tv)).toMatchObject({ debt: 250000, won: 3 });
  });
  it("retains a deactivated closer's production without making them available for transfers", async () => {
    const live = await closerStats();
    expect(live.find(r => r.id === "former")).toMatchObject({ debtClosed: 50000, state: "OFFLINE", free: false, canReceiveTransfers: false });
    expect(live.find(r => r.id === "active")).toMatchObject({ free: true, canReceiveTransfers: true });
  });
  it("keeps the floor's month boundary consistent with TV across DST", () => {
    expect(easternBoundaries(Date.parse("2026-03-24T12:00Z")).startOfMonth.toISOString()).toBe("2026-03-01T05:00:00.000Z");
    expect(easternBoundaries(Date.parse("2026-11-24T12:00Z")).startOfMonth.toISOString()).toBe("2026-11-01T04:00:00.000Z");
  });
});
