/** Shared assignment policy for records and analytics; contacts remain owner-only. */
export function ownedRecordScope(entity: string, ownerIds: string[], includeNegotiator = true): Record<string, unknown> {
  const field = entity === 'lead' || entity === 'opportunity' ? 'assignedToId' : 'ownerId';
  const owned = { [field]: { in: ownerIds } };
  if (!includeNegotiator) return owned;
  if (entity === 'account') return { OR: [owned, { assignedNegotiatorId: { in: ownerIds } }] };
  if (entity === 'opportunity') return { OR: [owned, { account: { is: { assignedNegotiatorId: { in: ownerIds } } } }] };
  return owned;
}
