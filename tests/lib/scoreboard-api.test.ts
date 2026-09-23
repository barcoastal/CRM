import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), upsert: vi.fn(), count: vi.fn(), transaction: vi.fn(), monthly: vi.fn(), wins: vi.fn(), passes: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { count: mocks.count }, closerScoreboardTarget: { upsert: mocks.upsert }, $transaction: mocks.transaction } }));
vi.mock("@/lib/scoreboard", () => ({ monthlyScoreboard: mocks.monthly, scoreboardWins: mocks.wins, scoreboardPasses: mocks.passes }));
import { PUT } from "@/app/api/scoreboard/targets/route";
import { GET as monthly } from "@/app/api/scoreboard/monthly/route";
import { GET as wins } from "@/app/api/scoreboard/wins/route";
import { GET as passes } from "@/app/api/scoreboard/passes/route";
const target = { userId: "a", debtTarget: 7500000, contractTarget: 20, firstPaymentDebtTarget: 6750000 };
const body = { period: "2026-09", targets: [target] };
const request = (value: unknown = body) => new Request("http://localhost/api/scoreboard/targets", { method: "PUT", body: JSON.stringify(value) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ session: { userId: "admin", permissions: ["Setup.Admin"] } });
  mocks.count.mockResolvedValue(1); mocks.upsert.mockReturnValue("save"); mocks.transaction.mockResolvedValue([]); mocks.monthly.mockResolvedValue([]);
});
describe("scoreboard API permissions and validation", () => {
  it.each([401, 403])("requires setup permission before goal changes (%s)", async (status) => {
    mocks.auth.mockResolvedValue({ response: Response.json({ error: "Denied" }, { status }) });
    expect((await PUT(request())).status).toBe(status); expect(mocks.auth).toHaveBeenCalledWith("Setup.Admin"); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("saves goals atomically for the chosen month", async () => {
    expect((await PUT(request())).status).toBe(200); expect(mocks.transaction).toHaveBeenCalledWith(["save"]);
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ where: { userId_period: { userId: "a", period: "2026-09" } }, create: { ...target, period: "2026-09" } });
  });
  it("supports clearing a goal without affecting another month or routing tiers", async () => {
    expect((await PUT(request({ ...body, targets: [{ ...target, debtTarget: null }] }))).status).toBe(200);
    expect(mocks.upsert.mock.calls[0][0].update).toEqual({ debtTarget: null, contractTarget: 20, firstPaymentDebtTarget: 6750000 });
  });
  it.each([
    { ...body, period: "2026-13" }, { ...body, targets: [target, target] }, { ...body, targets: [] },
    { ...body, targets: [{ ...target, debtTarget: -1 }] }, { ...body, targets: [{ ...target, contractTarget: 1.5 }] },
  ])("rejects invalid goal payloads before DB writes", async (value) => {
    expect((await PUT(request(value))).status).toBe(400); expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects targets for removed or inactive closers", async () => { mocks.count.mockResolvedValue(0); expect((await PUT(request())).status).toBe(409); expect(mocks.transaction).not.toHaveBeenCalled(); });
  it("guards read endpoints when signed out", async () => {
    mocks.auth.mockResolvedValue({ response: Response.json({ error: "Denied" }, { status: 401 }) });
    expect((await monthly(new Request("http://localhost/api/scoreboard/monthly"))).status).toBe(401);
    expect((await wins(new Request("http://localhost/api/scoreboard/wins"))).status).toBe(401);
    expect((await passes(new Request("http://localhost/api/scoreboard/passes"))).status).toBe(401);
    expect(mocks.passes).not.toHaveBeenCalled();
    expect(mocks.monthly).not.toHaveBeenCalled(); expect(mocks.wins).not.toHaveBeenCalled();
  });
  it("rejects invalid month and future win cursor", async () => {
    expect((await monthly(new Request("http://localhost/api/scoreboard/monthly?period=nope"))).status).toBe(400);
    expect((await wins(new Request("http://localhost/api/scoreboard/wins?since=2099-01-01"))).status).toBe(400);
    expect(mocks.monthly).not.toHaveBeenCalled(); expect(mocks.wins).not.toHaveBeenCalled();
  });
  it("marks monthly results private and disables editing for ordinary users", async () => {
    mocks.auth.mockResolvedValue({ session: { userId: "closer", permissions: [] } });
    const response = await monthly(new Request("http://localhost/api/scoreboard/monthly?period=2026-09"));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ period: "2026-09", canManage: false });
  });
});

describe("pass API", () => {
  it.each(["since=bad", "since=2099-01-01", `after=${"x".repeat(101)}`])("rejects invalid cursors: %s", async (query) => {
    expect((await passes(new Request(`http://localhost/api/scoreboard/passes?${query}`))).status).toBe(400);
    expect(mocks.passes).not.toHaveBeenCalled();
  });
  it("returns private live events and preserves the composite cursor", async () => {
    const payload = { events: [], cursor: { at: "2026-09-24T12:00:00Z", id: "" }, hasMore: false };
    mocks.passes.mockResolvedValue(payload);
    const response = await passes(new Request("http://localhost/api/scoreboard/passes?since=2026-09-23T12:00:00Z&after=handoff-99"));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(payload);
    expect(mocks.passes).toHaveBeenCalledWith({ at: "2026-09-23T12:00:00Z", id: "handoff-99" });
  });
});
