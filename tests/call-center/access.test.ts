import { beforeEach, describe, expect, it, vi } from "vitest";
import { callingAccess, CALL_CENTER_PATHS } from "@/lib/call-center/access";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  user: vi.fn(),
  permissions: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("@/lib/api-auth", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.user } },
}));
vi.mock("@/lib/permissions", () => ({
  loadEffectivePermissions: mocks.permissions,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { requireCallCenterPage } from "@/lib/call-center/page-access";
const opener = {
  isActive: true,
  role: "AGENT",
  isCloser: false,
  closerTier: null,
};
const closer = { ...opener, isCloser: true, closerTier: 2 };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    userId: "agent",
    role: "ADMIN",
    permissions: ["Modify.AllData"],
  });
  mocks.user.mockResolvedValue(opener);
  mocks.permissions.mockResolvedValue(new Set(["Call.Log"]));
});
describe("separate call-center screen access", () => {
  it("an explicitly assigned manager can see all desks without changing their calling role", () => {
    const user = { ...closer, role: "ADMIN" };
    expect(callingAccess(user, ["Call.Log", "CallCenter.ViewAllDesks"])).toEqual({
      opener: true, closer: true, floor: true, operations: true,
      home: CALL_CENTER_PATHS.floor,
    });
    expect(user).toEqual({ ...closer, role: "ADMIN" });
  });
  it("the desk-view grant alone does not grant calling or supervision", () => {
    expect(callingAccess(opener, ["Call.Log", "CallCenter.ViewAllDesks"]))
      .toMatchObject({ opener: true, closer: false, floor: false, operations: false });
    expect(callingAccess({ ...closer, role: "ADMIN" }, ["CallCenter.ViewAllDesks"]))
      .toMatchObject({ opener: false, closer: false, floor: false, operations: false });
    expect(callingAccess({ ...closer, role: "ADMIN", isActive: false }, ["Modify.AllData", "CallCenter.ViewAllDesks"]))
      .toMatchObject({ opener: false, closer: false, floor: false, operations: false });
  });
  it.each(["opener", "closer", "floor", "operations"] as const)(
    "allows an explicitly assigned manager to load %s directly", async screen => {
      mocks.user.mockResolvedValue({ ...closer, role: "ADMIN" });
      mocks.permissions.mockResolvedValue(new Set(["Call.Log", "CallCenter.ViewAllDesks"]));
      await expect(requireCallCenterPage(screen)).resolves.toMatchObject({ [screen]: true });
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );
  it("revoking all-desk access restores the current role's screen restrictions", async () => {
    mocks.user.mockResolvedValue({ ...closer, role: "ADMIN" });
    mocks.permissions.mockResolvedValue(new Set(["Call.Log"]));
    await expect(requireCallCenterPage("opener")).rejects.toThrow(`REDIRECT:${CALL_CENTER_PATHS.floor}`);
  });
  it("an opener receives only the opener desk", () => {
    expect(callingAccess(opener, ["Call.Log"])).toEqual({
      opener: true,
      closer: false,
      floor: false,
      operations: false,
      home: CALL_CENTER_PATHS.opener,
    });
  });
  it("a closer receives only the closer desk", () => {
    expect(callingAccess(closer, ["Call.Log"])).toEqual({
      opener: false,
      closer: true,
      floor: false,
      operations: false,
      home: CALL_CENTER_PATHS.closer,
    });
  });
  it("a tier assignment is respected even if the legacy closer flag is unset", () => {
    expect(
      callingAccess({ ...opener, closerTier: 3 }, ["Call.Log"]),
    ).toMatchObject({ opener: false, closer: true });
  });
  it("explicit supervisors receive the live floor and campaign administration", () => {
    expect(
      callingAccess(opener, ["Call.Log", "CallCenter.Supervise"]),
    ).toMatchObject({
      floor: true,
      operations: true,
      closer: false,
      home: CALL_CENTER_PATHS.floor,
    });
  });
  it("a manager title without supervision permission does not grant floor access", () => {
    expect(
      callingAccess({ ...opener, role: "MANAGER" }, ["Call.Log"]),
    ).toMatchObject({ floor: false, operations: false });
  });
  it.each(["Call.Log", "Modify.AllData"])("admins with %s keep their assigned desk unless explicitly granted both", permission => {
    expect(
      callingAccess({ ...closer, role: "ADMIN" }, [permission]),
    ).toMatchObject({
      opener: false,
      closer: true,
      floor: true,
      operations: true,
      home: CALL_CENTER_PATHS.floor,
    });
  });
  it.each([{ ...opener, isActive: false }, opener])(
    "inactive users and users without calling permissions receive no screens",
    (user) => {
      expect(callingAccess(user, [])).toEqual({
        opener: false,
        closer: false,
        floor: false,
        operations: false,
        home: "/dashboard",
      });
    },
  );
  it("an inactive admin cannot retain screens through broad permissions", () => {
    expect(
      callingAccess({ ...closer, role: "ADMIN", isActive: false }, [
        "Modify.AllData",
      ]),
    ).toMatchObject({ floor: false, operations: false, closer: false });
  });
  it.each(["closer", "floor", "operations"] as const)(
    "direct requests for %s redirect an opener to their own desk",
    async (screen) => {
      await expect(requireCallCenterPage(screen)).rejects.toThrow(
        `REDIRECT:${CALL_CENTER_PATHS.opener}`,
      );
    },
  );
  it("direct requests for the opener desk redirect a closer", async () => {
    mocks.user.mockResolvedValue(closer);
    await expect(requireCallCenterPage("opener")).rejects.toThrow(
      `REDIRECT:${CALL_CENTER_PATHS.closer}`,
    );
  });
  it("uses current database permissions rather than old admin claims in the session", async () => {
    await expect(requireCallCenterPage("floor")).rejects.toThrow(
      `REDIRECT:${CALL_CENTER_PATHS.opener}`,
    );
    expect(mocks.permissions).toHaveBeenCalledWith("agent");
    expect(mocks.user).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "agent" },
        select: expect.objectContaining({
          role: true,
          isCloser: true,
          closerTier: true,
          isActive: true,
        }),
      }),
    );
  });
  it("lets a permitted manager render the management screen", async () => {
    mocks.permissions.mockResolvedValue(
      new Set(["Call.Log", "CallCenter.Supervise"]),
    );
    await expect(requireCallCenterPage("operations")).resolves.toMatchObject({
      operations: true,
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("revoking calling access removes every call-center screen", async () => {
    mocks.permissions.mockResolvedValue(new Set());
    await expect(requireCallCenterPage("opener")).rejects.toThrow(
      "REDIRECT:/dashboard",
    );
  });
  it("deactivated users return to login", async () => {
    mocks.user.mockResolvedValue({ ...opener, isActive: false });
    await expect(requireCallCenterPage("opener")).rejects.toThrow(
      "REDIRECT:/login",
    );
  });
});
