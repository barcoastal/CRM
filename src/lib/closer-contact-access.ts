/** A deny marker in effective permissions takes precedence over inherited grants. */
export const CONTACT_ACCESS_DENIED = "Contact.AccessDenied";

export function isCloserUser(user: {
  role?: string | null;
  isCloser?: boolean | null;
  closerTier?: number | null;
  profile?: { name: string } | null;
  hierarchyRole?: { name: string; developerName: string } | null;
}): boolean {
  return user.isCloser === true || user.closerTier != null ||
    user.role?.toUpperCase() === "CLOSER" ||
    user.profile?.name.toLowerCase() === "closer" ||
    user.hierarchyRole?.name.toLowerCase() === "closer" ||
    user.hierarchyRole?.developerName.toLowerCase() === "closer";
}

export function deniesContactAccess(grants: Set<string>, required: string): boolean {
  return required.startsWith("Contact.") && grants.has(CONTACT_ACCESS_DENIED);
}
