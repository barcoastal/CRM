import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => {
  const model = () => ({ findMany: vi.fn(), count: vi.fn() });
  return {
    scope: vi.fn(),
    auth: vi.fn(),
    lead: model(),
    opportunity: model(),
    contact: model(),
    account: model(),
    user: model(),
    case: model(),
    task: model(),
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: m }));
vi.mock("@/lib/record-access", () => ({ recordScope: m.scope }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: m.auth }));
import { globalSearch } from "@/lib/global-search";
import { GET } from "@/app/api/search/route";
import {
  normalizeSearchQuery,
  searchHref,
  searchPage,
  searchSort,
  searchType,
} from "@/lib/search-types";
const session = {
  userId: "rep",
  email: "rep@example.invalid",
  role: "SALES_REP",
  profileName: null,
  permissions: ["Lead.View"],
};
const lead = {
  id: "lead-1",
  sfId: null,
  sfDataJson:
    '{"Lead_Id__c":13101009,"Sub_Disposition__c":"Test Lead","SSN__c":"123-45-6789"}',
  contactName: "Bar Elezra",
  businessName: "Albert Capital",
  phone: "6153354714",
  status: "NEW",
  source: "WEBSITE",
  lastSubDisposition: null,
  assignedTo: { name: "Owner" },
};
beforeEach(() => {
  vi.clearAllMocks();
  for (const model of [
    m.lead,
    m.opportunity,
    m.contact,
    m.account,
    m.user,
    m.case,
    m.task,
  ]) {
    model.findMany.mockResolvedValue([]);
    model.count.mockResolvedValue(0);
  }
  m.scope.mockResolvedValue({ assignedToId: { in: ["rep"] } });
  m.auth.mockResolvedValue({ session });
});
describe("global search", () => {
  it("returns exact counts with a five-row overview and scoped queries", async () => {
    m.lead.count.mockResolvedValue(63);
    m.lead.findMany.mockResolvedValue([lead]);
    const result = await globalSearch(session, { query: "Bar", full: true });
    expect(result.total).toBe(63);
    expect(result.groups[0].count).toBe(63);
    expect(m.lead.findMany.mock.calls[0][0]).toMatchObject({
      take: 5,
      skip: 0,
    });
    expect(m.lead.count.mock.calls[0][0].where).toEqual(
      m.lead.findMany.mock.calls[0][0].where,
    );
    expect(m.lead.count.mock.calls[0][0].where.AND).toEqual([
      { assignedToId: { in: ["rep"] } },
    ]);
    expect(result.groups[0].rows[0].cells[1].text).toBe("13101009");
    expect(result.groups[0].rows[0].cells[7].text).toBe("Test Lead");
    expect(JSON.stringify(result)).not.toContain("123-45-6789");
    expect(JSON.stringify(result)).not.toContain("sfDataJson");
  });
  it("never queries or counts record types without view permission", async () => {
    await globalSearch(session, { query: "Bar", full: true });
    for (const model of [
      m.opportunity,
      m.contact,
      m.account,
      m.user,
      m.case,
      m.task,
    ]) {
      expect(model.count).not.toHaveBeenCalled();
      expect(model.findMany).not.toHaveBeenCalled();
    }
    expect(m.scope).toHaveBeenCalledTimes(1);
  });
  it("paginates beyond the suggestion limit and clamps out-of-range pages", async () => {
    m.lead.count.mockResolvedValue(63);
    await globalSearch(session, {
      query: "Bar",
      full: true,
      type: "leads",
      page: 2,
    });
    expect(m.lead.findMany.mock.lastCall?.[0]).toMatchObject({
      skip: 25,
      take: 25,
    });
    const last = await globalSearch(session, {
      query: "Bar",
      full: true,
      type: "leads",
      page: 99999,
    });
    expect(last.groups[0].page).toBe(3);
    expect(m.lead.findMany.mock.lastCall?.[0]).toMatchObject({
      skip: 50,
      take: 25,
    });
  });
  it("does not fetch rows from other categories on a filtered page", async () => {
    m.lead.count.mockResolvedValue(20);
    m.account.count.mockResolvedValue(3);
    const result = await globalSearch(
      { ...session, permissions: ["Lead.View", "Account.View"] },
      { query: "Bar", full: true, type: "accounts" },
    );
    expect(result.total).toBe(23);
    expect(m.lead.findMany).not.toHaveBeenCalled();
    expect(m.account.findMany).toHaveBeenCalled();
  });
  it("has deterministic database sorting across pages", async () => {
    m.lead.count.mockResolvedValue(2);
    await globalSearch(session, {
      query: "Bar",
      full: true,
      sort: "name-desc",
    });
    expect(m.lead.findMany.mock.lastCall?.[0].orderBy).toEqual([
      { contactName: "desc" },
      { id: "asc" },
    ]);
  });
  it("does not run expensive counts for quick suggestions", async () => {
    m.lead.findMany.mockResolvedValue([lead]);
    const result = await globalSearch(session, { query: "Bar" });
    expect(m.lead.count).not.toHaveBeenCalled();
    expect(result.groups[0].rows[0].href).toBe("/leads/lead-1");
  });
  it("escapes wildcard characters and has no empty match-all OR clause", async () => {
    await globalSearch(session, { query: "a_%" });
    const conditions = m.lead.findMany.mock.lastCall?.[0].where.OR;
    expect(conditions[0]).toEqual({
      contactName: { contains: "a\\_\\%", mode: "insensitive" },
    });
    expect(
      conditions.every((c: object) =>
        Object.values(c).every((v) => v !== undefined),
      ),
    ).toBe(true);
  });
  it("searches formatted phone input using its digits too", async () => {
    await globalSearch(session, { query: "(615) 335-4714" });
    expect(m.lead.findMany.mock.lastCall?.[0].where.OR).toContainEqual({
      phone: { contains: "6153354714" },
    });
  });
  it("requires a session and does not search for short or oversized queries", async () => {
    m.auth.mockResolvedValueOnce({
      response: Response.json({}, { status: 401 }),
    });
    expect(
      (await GET(new Request("http://localhost/api/search?q=Bar"))).status,
    ).toBe(401);
    expect(
      await (
        await GET(new Request("http://localhost/api/search?q=b&view=all"))
      ).json(),
    ).toEqual({ query: "b", total: 0, groups: [] });
    expect(
      (
        await GET(
          new Request("http://localhost/api/search?q=" + "a".repeat(201)),
        )
      ).status,
    ).toBe(400);
    expect(m.lead.findMany).not.toHaveBeenCalled();
  });
  it("preserves quick-suggestion JSON and supplies the full result shape", async () => {
    m.lead.findMany.mockResolvedValue([lead]);
    m.lead.count.mockResolvedValue(20);
    const quick = await GET(new Request("http://localhost/api/search?q=Bar"));
    expect((await quick.json()).results[0]).toMatchObject({
      title: "Bar Elezra",
      entity: "Lead",
      href: "/leads/lead-1",
    });
    const full = await GET(
      new Request(
        "http://localhost/api/search?q=Bar&view=all&type=leads&page=2",
      ),
    );
    expect((await full.json()).total).toBe(20);
    expect(full.headers.get("cache-control")).toContain("no-store");
  });
  it("handles names and URLs containing reserved characters", () => {
    const url = new URL(
      searchHref("  Bar   & Sons  ", "leads", 2, "newest"),
      "http://localhost",
    );
    expect(url.searchParams.get("q")).toBe("Bar & Sons");
    expect(url.searchParams.get("page")).toBe("2");
    expect(normalizeSearchQuery(" a  b ")).toBe("a b");
    expect(searchType("passwordHash")).toBeUndefined();
    expect(searchSort("passwordHash")).toBe("name");
    expect(searchPage("-1")).toBe(1);
    expect(searchPage("Infinity")).toBe(1);
  });
});
