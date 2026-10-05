import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const mocks = vi.hoisted(() => {
  const model = () => ({ count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) });
  return { auth: vi.fn(), db: { user: { findUnique: vi.fn() }, lead: model(), opportunity: model(), account: model(), contact: model(), task: model(), case: model(), auditLog: model(), accountHistory: model() } };
});
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/components/admin/user-preview", () => ({ ViewAsUserButton: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import UserRecordPage from "@/app/(dashboard)/settings/users/[id]/page";
import { ownerProfileLink } from "@/components/users/owner-profile-link";
import { RecordLinkCell } from "@/components/lists/record-link-cell";
import { userOwnedRecords, userRecordType } from "@/lib/user-owned-records";

const props = (query = {}) => ({ params: Promise.resolve({ id: "owner-123" }), searchParams: Promise.resolve(query) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.user.findUnique.mockResolvedValue({ id: "owner-123", name: "Owner Example", email: "owner@example.test", role: "SALES_REP", isActive: true });
  mocks.auth.mockResolvedValue({ user: { id: "admin", role: "ADMIN", permissions: [] } });
  for (const key of ["lead", "opportunity", "account", "contact", "task", "case", "auditLog", "accountHistory"] as const) {
    mocks.db[key].findMany.mockResolvedValue([]);
    mocks.db[key].count.mockResolvedValue(0);
  }
});

describe("owner profile authorization", () => {
  it.each(["SALES_REP", "MANAGER", "NEGOTIATOR", "UNAVAILABLE"])("denies %s even with user-view or all-data grants, before querying records", async role => {
    mocks.auth.mockResolvedValue({ user: { id: "owner-123", role, permissions: ["User.View", "Modify.AllData"] } });
    const html = renderToStaticMarkup(await UserRecordPage(props()));
    expect(html).toContain("You don’t have permission");
    expect(html).not.toContain("owner@example.test");
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.db.lead.count).not.toHaveBeenCalled();
  });
  it("denies unauthenticated requests", async () => {
    mocks.auth.mockResolvedValue(null);
    expect(renderToStaticMarkup(await UserRecordPage(props()))).toContain("Access denied");
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
  });
  it("shows admins the selected owner's records and owner-specific category links", async () => {
    mocks.db.lead.count.mockResolvedValue(27);
    mocks.db.lead.findMany.mockResolvedValue([{ id: "converted-lead", contactName: "Example Lead", businessName: "Example Business", status: "Converted" }]);
    const html = renderToStaticMarkup(await UserRecordPage(props()));
    expect(html).toContain("Owner Example");
    expect(html).toContain('href="/leads/converted-lead"');
    expect(html).toContain("Converted");
    expect(html).toContain("records=cases");
    expect(html).toContain("page=2");
    expect(mocks.db.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { assignedToId: "owner-123" }, skip: 0, take: 25 }));
  });
  it("paginates all activity sections within the selected user", async () => {
    await UserRecordPage(props({ activityPage: "2", auditPage: "3", changesPage: "4" }));
    expect(mocks.db.task.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "owner-123" }, skip: 30, take: 31 }));
    expect(mocks.db.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner-123" }, skip: 100, take: 51 }));
    expect(mocks.db.accountHistory.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { changedById: "owner-123" }, skip: 90, take: 31 }));
  });
  it("returns not-found for an unknown user", async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);
    await expect(UserRecordPage(props())).rejects.toThrow("NOT_FOUND");
  });
});

describe("assigned records", () => {
  it.each([
    ["leads", "lead", "assignedToId"], ["opportunities", "opportunity", "assignedToId"],
    ["accounts", "account", "ownerId"], ["contacts", "contact", "ownerId"],
    ["tasks", "task", "ownerId"], ["cases", "case", "ownerId"],
  ] as const)("scopes and paginates %s without hiding completed work", async (type, model, field) => {
    await userOwnedRecords("owner-123", type, 2);
    expect(mocks.db[model].findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { [field]: "owner-123" }, skip: 25, take: 25 }));
  });
  it("falls back to leads for invalid categories", () => expect(userRecordType("unknown")).toBe("leads"));
});

it("owner links keep the profile destination even in the first table column", () => {
  const html = renderToStaticMarkup(createElement(RecordLinkCell, { href: "/leads/lead-123" }, ownerProfileLink("owner-123", "ssweet")));
  expect(html).toContain('href="/settings/users/owner-123"');
  expect(html).not.toContain('href="/leads/lead-123"');
  expect(html.match(/<a /g)).toHaveLength(1);
  expect(ownerProfileLink(null, "Queue")).toBe("Queue");
});
