/** Derive the list-view alias from an email or name (8 chars, lowercase). */
export function ownerAlias(
  user: { name?: string | null; email?: string | null } | null,
): string {
  if (!user) return "";
  if (user.email) return user.email.split("@")[0].toLowerCase().slice(0, 8);
  if (user.name) return user.name.replace(/\s+/g, "").toLowerCase().slice(0, 8);
  return "";
}
