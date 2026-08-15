/** Pure helpers for the send_email flow node. */

export function ownerFieldFor(entityType: string): string | null {
  switch (entityType) {
    case "Lead":
    case "Opportunity":
      return "assignedToId";
    case "Contact":
    case "Account":
    case "Case":
      return "ownerId";
    default:
      return null;
  }
}

export function buildFromAddress(
  user: { name: string | null; mailboxAddress: string | null; email: string | null } | null,
): string | null {
  if (!user) return null;
  const addr = user.mailboxAddress ?? user.email;
  if (!addr) return null;
  const safeName = (user.name ?? addr).replace(/"/g, '\\"');
  return `"${safeName}" <${addr}>`;
}
