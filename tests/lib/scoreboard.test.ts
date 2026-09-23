import { describe, expect, it, vi, beforeEach } from "vitest";
import { currentScoreboardPeriod, scoreboardMonthRange, targetPercent, totalScoreboard, unseenWins, validScoreboardPeriod, type WinEvent } from "@/lib/scoreboard-shared";
const mocks = vi.hoisted(() => ({ users: vi.fn(), targets: vi.fn(), query: vi.fn(), history: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findMany: mocks.users }, closerScoreboardTarget: { findMany: mocks.targets }, $queryRaw: mocks.query, opportunityHistory: { findMany: mocks.history } } }));
import { monthlyScoreboard, scoreboardWins } from "@/lib/scoreboard";

beforeEach(() => { vi.resetAllMocks(); mocks.users.mockResolvedValue([]); mocks.targets.mockResolvedValue([]); mocks.query.mockResolvedValue([]); mocks.history.mockResolvedValue([]); });
describe("monthly scoreboard", () => {
  it("uses Eastern months at the UTC month boundary", () => {
    expect(currentScoreboardPeriod(new Date("2026-10-01T03:59:59Z"))).toBe("2026-09");
    expect(currentScoreboardPeriod(new Date("2026-10-01T04:00:00Z"))).toBe("2026-10");
  });
  it.each([
    ["2026-03", "2026-03-01T05:00:00.000Z", "2026-04-01T04:00:00.000Z"],
    ["2026-11", "2026-11-01T04:00:00.000Z", "2026-12-01T05:00:00.000Z"],
    ["2026-12", "2026-12-01T05:00:00.000Z", "2027-01-01T05:00:00.000Z"],
  ])("handles DST and year rollover for %s", (period, from, to) => {
    const range = scoreboardMonthRange(period);
    expect(range.from.toISOString()).toBe(from); expect(range.to.toISOString()).toBe(to);
  });
  it.each(["2026-00", "2026-13", "2026-1", "bad", "2026-09-01", "1900-01"])("rejects invalid period %s", (period) => {
    expect(validScoreboardPeriod(period)).toBe(false); expect(() => scoreboardMonthRange(period)).toThrow();
  });
  it("does not invent progress for missing or zero goals", () => {
    expect(targetPercent(100, null)).toBeNull(); expect(targetPercent(100, 0)).toBeNull(); expect(targetPercent(1_090_000, 7_500_000)).toBeCloseTo(14.5333);
    expect(targetPercent(8_176_000, 7_500_000)).toBeCloseTo(109.0133);
  });
  it("keeps zero-production closers, attaches goals, and subtracts canceled debt", async () => {
    mocks.users.mockResolvedValue([{ id: "a", name: "Alex", closerTier: 1 }, { id: "b", name: "Blake", closerTier: 2 }]);
    mocks.query.mockResolvedValue([{ userId: "b", transfers: 14, contractsOut: 2, signed: 5, grossDebt: 800000, canceled: 1, canceledDebt: 125000, won: 3, paid: 2, paidDebt: 240000 }]);
    mocks.targets.mockResolvedValue([{ userId: "b", debtTarget: 1000000, contractTarget: 10, firstPaymentDebtTarget: 500000 }]);
    const rows = await monthlyScoreboard("2026-09", new Date("2026-09-23T12:00:00Z"));
    expect(rows.map((row) => row.userId)).toEqual(["b", "a"]);
    expect(rows[0]).toMatchObject({ netDebt: 675000, debtTarget: 1000000, firstPaymentDebtTarget: 500000 });
    expect(rows[1]).toMatchObject({ grossDebt: 0, netDebt: 0, won: 0, debtTarget: null });
    expect(totalScoreboard(rows)).toMatchObject({ debt: 800000, netDebt: 675000, target: 1000000, targetCount: 1, signed: 5, paid: 2 });
    // Unrelated edits to an opportunity must not move an old win into this month.
    expect(mocks.query.mock.calls[0][0].sql).not.toContain("lastDispositionAt");
  });
  it("does not run an unbounded query when no closers are configured", async () => { expect(await monthlyScoreboard("2026-09")).toEqual([]); expect(mocks.query).not.toHaveBeenCalled(); });
});

describe("touchdown event feed", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  const historyRow = (id: string) => ({ id, opportunityId: `opp-${id}`, changedAt: new Date("2026-09-23T11:59:50Z"), opportunity: { totalDebt: 125000, assignedTo: { id: "a", name: "Alex" } } });
  it("starts a fresh TV session without replaying past wins", async () => {
    expect(await scoreboardWins(null, now)).toEqual({ events: [], cursor: { at: "2026-09-23T11:59:58.000Z", id: "" }, hasMore: false });
    expect(mocks.history).not.toHaveBeenCalled();
  });
  it("excludes movement between Closed Won substages and requires current won status", async () => {
    mocks.history.mockResolvedValue([historyRow("win-1")]);
    const result = await scoreboardWins({ at: "2026-09-23T11:59:40Z", id: "" }, now);
    const where = mocks.history.mock.calls[0][0].where;
    expect(where.AND[0].OR[1].NOT.oldValue).toEqual({ startsWith: "Closed Won", mode: "insensitive" });
    expect(where.opportunity.stage).toEqual({ startsWith: "Closed Won", mode: "insensitive" });
    expect(result.events[0]).toEqual({ id: "win-1", opportunityId: "opp-win-1", closerId: "a", closerName: "Alex", debt: 125000, at: "2026-09-23T11:59:50.000Z" });
    expect(result.cursor.at).toBe("2026-09-23T11:59:53.000Z");
  });
  it("paginates simultaneous wins with a composite timestamp and ID cursor", async () => {
    mocks.history.mockResolvedValue(Array.from({ length: 101 }, (_, i) => historyRow(`win-${String(i).padStart(3, "0")}`)));
    const first = await scoreboardWins({ at: "2026-09-23T11:59:40Z", id: "" }, now);
    expect(first.events).toHaveLength(100); expect(first.hasMore).toBe(true);
    expect(first.cursor).toEqual({ at: "2026-09-23T11:59:50.000Z", id: "win-099" });
    mocks.history.mockResolvedValue([historyRow("win-100")]);
    const second = await scoreboardWins(first.cursor, now);
    expect(second.events.map((event) => event.id)).toEqual(["win-100"]);
    expect(mocks.history.mock.calls[1][0].where.AND[1].OR[1]).toEqual({ changedAt: new Date(first.cursor.at), id: { gt: "win-099" } });
  });
  it("bounds reconnection to one hour instead of replaying days of wins", async () => {
    await scoreboardWins({ at: "2026-09-20T12:00:00Z", id: "" }, now);
    expect(mocks.history.mock.calls[0][0].where.AND[1].OR[0].changedAt.gt).toEqual(new Date("2026-09-23T11:00:00Z"));
  });
  it("deduplicates overlapping polls while keeping all simultaneous closers", () => {
    const a: WinEvent = { id: "a", opportunityId: "1", closerId: "1", closerName: "Alex", debt: 20, at: now.toISOString() };
    const b = { ...a, id: "b", closerName: "Blake" };
    const c = { ...a, id: "c", closerName: "Casey" };
    expect(unseenWins([c, b, a, b], new Set(["a"])).map((row) => row.id)).toEqual(["b", "c"]);
  });
});
