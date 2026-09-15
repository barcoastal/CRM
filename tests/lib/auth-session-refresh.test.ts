import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), permissions: vi.fn(), config: null as any }));
vi.mock("next-auth", () => ({ default: (config: unknown) => { mocks.config = config; return {}; } }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/permissions", () => ({ loadEffectivePermissions: mocks.permissions }));
import "../../src/lib/auth";

describe("existing session authorization refresh", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("revokes an existing session when the user is disabled", async () => {
    mocks.findUnique.mockResolvedValue({ id: "u", isActive: false });
    expect(await mocks.config.callbacks.jwt({ token: { id: "u", role: "ADMIN" } })).toBeNull();
    expect(mocks.permissions).not.toHaveBeenCalled();
  });
  it("revokes a deleted user's session", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await mocks.config.callbacks.jwt({ token: { id: "u" } })).toBeNull();
  });
  it("replaces stale role and permissions on an existing session", async () => {
    mocks.findUnique.mockResolvedValue({ id: "u", isActive: true, role: "AGENT", profile: { name: "Restricted" }, mustResetPassword: true });
    mocks.permissions.mockResolvedValue(new Set(["Opportunity.View"]));
    const result = await mocks.config.callbacks.jwt({ token: { id: "u", role: "ADMIN", permissions: ["Modify.AllData"] } });
    expect(result).toMatchObject({ role: "AGENT", permissions: ["Opportunity.View"], profileName: "Restricted", mustResetPassword: true });
  });
  it("does not retain stale grants when the database fails", async () => {
    mocks.findUnique.mockRejectedValue(new Error("unavailable"));
    await expect(mocks.config.callbacks.jwt({ token: { id: "u", permissions: ["Modify.AllData"] } })).rejects.toThrow("unavailable");
  });
});
