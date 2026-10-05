import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  user: vi.fn(),
  users: vi.fn(),
  contacts: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: m.user, findMany: m.users }, contact: { findMany: m.contacts } },
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));

import { CONTACT_ACCESS_DENIED } from "@/lib/closer-contact-access";
import { hasPermission, loadEffectivePermissions } from "@/lib/permissions";
import { canViewNavigation } from "@/lib/navigation-access";
import { recordScope } from "@/lib/record-access";
import { GET as splitList } from "@/app/api/split-list/route";
import { GET as listContacts } from "@/app/api/contacts/route";
import { POST as bulkEmailContacts } from "@/app/api/contacts/bulk-email/route";

const permissionSet = {
  permissions: [{ key: "Contact.View" }, { key: "Contact.Edit" }, { key: "Modify.AllData" }, { key: "Opportunity.View" }],
  groupItems: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  m.user.mockResolvedValue({
    id: "closer", role: "SALES_REP", isActive: true, isCloser: false, closerTier: null,
    profile: { name: "Sales", permissions: [{ permissionSet }] },
    hierarchyRole: null, permissionSets: [],
  });
  m.users.mockResolvedValue([]);
  m.contacts.mockResolvedValue([]);
});

describe("closer Contact access", () => {
  it.each([
    { role: "CLOSER" },
    { isCloser: true },
    { closerTier: 2 },
    { profile: { name: "Closer", permissions: [{ permissionSet }] } },
    { hierarchyRole: { name: "Closer", developerName: "Closer" } },
  ])("denies Contact access for closer identity %j even with inherited and global grants", async (override) => {
    m.user.mockResolvedValueOnce({ ...await m.user.getMockImplementation()!(), ...override });
    const grants = await loadEffectivePermissions("closer");
    expect(grants.has(CONTACT_ACCESS_DENIED)).toBe(true);
    expect([...grants].some((key) => key === "Contact.View" || key === "Contact.Edit")).toBe(false);
    expect(hasPermission(grants, "Contact.View")).toBe(false);
    expect(hasPermission(grants, "Contact.Edit")).toBe(false);
    expect(hasPermission(grants, "Opportunity.View")).toBe(true);
    expect(canViewNavigation("/contacts", [...grants])).toBe(false);
  });

  it("retains Contact access for a non-closer with the same profile grants", async () => {
    const grants = await loadEffectivePermissions("rep");
    expect(hasPermission(grants, "Contact.View")).toBe(true);
    expect(canViewNavigation("/contacts", [...grants])).toBe(true);
  });

  it("blocks direct Contact queries and the console split list", async () => {
    const grants = [CONTACT_ACCESS_DENIED, "Contact.View", "Modify.AllData"];
    m.auth.mockResolvedValue({ user: { id: "closer", email: "closer@example.com", role: "CLOSER", profileName: "Closer", permissions: grants } });
    expect(await recordScope("contact")).toEqual({ id: { in: [] } });
    const response = await splitList(new NextRequest("http://localhost/api/split-list?entity=contacts"));
    expect(response.status).toBe(403);
    const list = await listContacts(new NextRequest("http://localhost/api/contacts"));
    expect(list.status).toBe(403);
    const email = await bulkEmailContacts(new NextRequest("http://localhost/api/contacts/bulk-email", {
      method: "POST", body: JSON.stringify({ ids: ["contact-1"], subject: "Hi" }),
    }));
    expect(email.status).toBe(403);
    expect(m.contacts).not.toHaveBeenCalled();
  });
});
