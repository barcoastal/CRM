import { canSupervise } from "./model";

export type CallCenterScreen = "opener" | "closer" | "floor" | "operations";
export const CALL_CENTER_PATHS: Record<CallCenterScreen, string> = {
  opener: "/call-center/opener",
  closer: "/call-center/closer",
  floor: "/call-center/live-floor",
  operations: "/call-center/manage",
};

/** Screen access follows the current CRM permissions and Floor Manager role. */
export function callingAccess(
  user: {
    isActive: boolean;
    role: string;
    isCloser: boolean;
    closerTier: number | null;
  },
  permissions: string[],
) {
  const calling =
    user.isActive &&
    (permissions.includes("Call.Log") ||
      permissions.includes("Modify.AllData"));
  const closer = user.isCloser || typeof user.closerTier === "number";
  const manager = calling && canSupervise(user.role, permissions);
  const screens = {
    opener: calling && !closer,
    closer: calling && closer,
    floor: manager,
    operations: manager,
  };
  const home = !calling
    ? "/dashboard"
    : CALL_CENTER_PATHS[manager ? "floor" : closer ? "closer" : "opener"];
  return { ...screens, home };
}
