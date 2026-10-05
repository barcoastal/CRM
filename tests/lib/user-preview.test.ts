import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { previewBlocksRequest } from "@/lib/user-preview-policy";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), permissions: vi.fn(), audit: vi.fn(), config: {} as NextAuthConfig }));
vi.mock("next-auth", () => ({ default: (config: NextAuthConfig) => { mocks.config = config; return {}; } }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/permissions", () => ({ loadEffectivePermissions: mocks.permissions }));
vi.mock("@/lib/audit", () => ({ auditWrite: mocks.audit }));
import "../../src/lib/auth";

const admin = { id: "admin", name: "Admin", email: "admin@example.invalid", role: "ADMIN", isActive: true, mustResetPassword: false, profile: { name: "Administrator" } };
const reader = { id: "reader", name: "Reader", email: "reader@example.invalid", role: "SALES_REP", isActive: true, mustResetPassword: false, profile: { name: "Reader" } };
const viewAs = { userId: reader.id, name: reader.name, email: reader.email, startedAt: "2026-10-05T00:00:00Z" };
async function jwt(token: Partial<JWT>, command?: unknown) {
  const callback = mocks.config.callbacks!.jwt!;
  return callback({ token: token as JWT, ...(command ? { trigger: "update", session: command } : {}) } as Parameters<typeof callback>[0]);
}
async function session(token: JWT) {
  const callback = mocks.config.callbacks!.session!;
  return callback({ token, session: { user: {}, expires: "" } } as Parameters<typeof callback>[0]) as Promise<Session>;
}
describe("admin user preview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findUnique.mockImplementation(({ where }) => Promise.resolve(where.id === "admin" ? admin : reader));
    mocks.permissions.mockImplementation((id) => Promise.resolve(new Set(id === "admin" ? ["Modify.AllData"] : ["Account.View"])));
  });
  it("keeps the authenticated admin in the JWT and exposes only target identity and permissions", async () => {
    const token = await jwt({ id: "admin" }, { viewAsUserId: "reader" });
    expect(token?.id).toBe("admin");
    expect(token?.viewAs?.userId).toBe("reader");
    const preview = await session(token!);
    expect(preview.user).toMatchObject({ id: "reader", name: "Reader", email: reader.email, role: "SALES_REP", permissions: ["Account.View"] });
    expect(preview.impersonation).toMatchObject({ adminId: "admin", unavailable: false });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin", entityId: "reader", action: "CREATE" }));
  });
  it("cannot forge an admin identity or grants with a client session update", async () => {
    const token = await jwt({ id: "reader", role: "ADMIN", permissions: ["Modify.AllData"] }, { viewAsUserId: "admin", id: "admin", role: "ADMIN", permissions: ["Modify.AllData"], viewAs });
    expect(token).toMatchObject({ id: "reader", role: "SALES_REP", permissions: ["Account.View"] });
    expect(token?.viewAs).toBeUndefined();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each(["self", "inactive", "missing", "password-reset", "manager"])("rejects %s preview requests", async (kind) => {
    mocks.findUnique.mockImplementation(({ where }) => Promise.resolve(where.id === "admin"
      ? { ...admin, ...(kind === "password-reset" ? { mustResetPassword: true } : {}), ...(kind === "manager" ? { role: "MANAGER" } : {}) }
      : kind === "missing" ? null : { ...reader, isActive: kind !== "inactive" }));
    const token = await jwt({ id: "admin" }, { viewAsUserId: kind === "self" ? "admin" : "reader" });
    expect(token?.viewAs).toBeUndefined();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("prevents nesting and cannot return as a different admin", async () => {
    const token = await jwt({ id: "admin", viewAs }, { viewAsUserId: "third-user", adminId: "other" });
    expect(token?.viewAs).toEqual(viewAs);
    const restored = await jwt(token!, { viewAsUserId: null, id: "other" });
    expect(restored).toMatchObject({ id: "admin", role: "ADMIN" });
    expect(restored?.viewAs).toBeUndefined();
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin", entityId: "reader", action: "UPDATE" }));
  });
  it("refreshes target permissions on every read", async () => {
    const token = await jwt({ id: "admin", viewAs });
    mocks.permissions.mockResolvedValue(new Set(["Lead.View"]));
    expect((await session(token!)).user.permissions).toEqual(["Lead.View"]);
  });
  it.each(["target-disabled", "target-deleted", "admin-demoted", "admin-reset"])("fails closed for %s without silently restoring admin powers", async (kind) => {
    const token = await jwt({ id: "admin", viewAs });
    if (kind === "admin-demoted") token!.role = "SALES_REP";
    if (kind === "admin-reset") token!.mustResetPassword = true;
    if (kind === "target-disabled") mocks.findUnique.mockResolvedValue({ ...reader, isActive: false });
    if (kind === "target-deleted") mocks.findUnique.mockResolvedValue(null);
    const preview = await session(token!);
    expect(preview.user).toMatchObject({ id: "", role: "UNAVAILABLE", permissions: [] });
    expect(preview.impersonation?.unavailable).toBe(true);
    expect(token?.viewAs).toBeDefined();
  });
  it("revokes the entire session when the authenticated admin is disabled", async () => {
    mocks.findUnique.mockResolvedValue({ ...admin, isActive: false });
    expect(await jwt({ id: "admin", viewAs })).toBeNull();
  });
  it("does not start a preview if its audit record fails", async () => {
    mocks.audit.mockRejectedValue(new Error("Audit unavailable"));
    await expect(jwt({ id: "admin" }, { viewAsUserId: "reader" })).rejects.toThrow("Audit unavailable");
  });
});

describe("read-only request boundary", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("blocks %s for APIs and server actions", method => {
    for (const path of ["/api/accounts", "/api/auth/reset-password", "/api/auth/session", "/api/call-center", "/dashboards/new"])
      expect(previewBlocksRequest(method, path)).toBe(true);
  });
  it("allows viewing, returning and signing out", () => {
    expect(previewBlocksRequest("GET", "/api/accounts")).toBe(false);
    expect(previewBlocksRequest("POST", "/api/admin/user-preview")).toBe(false);
    expect(previewBlocksRequest("POST", "/api/auth/signout")).toBe(false);
  });
  it.each(["/api/integrations/google-calendar/callback", "/api/dialer/five9/agent/credentials", "/api/cadences/run", "/api/sms/send-queue", "/api/engagement/process", "/api/flow/poll", "/api/cron/sf-sync"])("blocks legacy GET side effects at %s", path => {
    expect(previewBlocksRequest("GET", path)).toBe(true);
  });
});
