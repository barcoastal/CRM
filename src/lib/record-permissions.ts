import { hasPermission } from "@/lib/permissions";

/** Entity-wide visibility comes from explicit grants, not job titles. */
export function hasAllRecordAccess(permissions: Iterable<string>, entity: string): boolean {
  const name = entity.charAt(0).toUpperCase() + entity.slice(1);
  return hasPermission(permissions, `${name}.ViewAll`) || hasPermission(permissions, `${name}.ModifyAll`);
}

export function hasBroadRecordGrant(permissions: string[]): boolean {
  return permissions.some(key => key === "Modify.AllData" || /\.(ViewAll|ModifyAll)$/.test(key));
}
