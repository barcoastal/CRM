type ContactIdentity = { id: string; birthdate: Date | null; ssn: string | null };

/** Resolve only Salesforce's explicit Opportunity.ContactId; never guess by name/account. */
export function opportunityContactIdentity(
  contactSfId: string | undefined,
  contacts: ReadonlyMap<string, ContactIdentity>,
) {
  if (contactSfId === undefined) throw new Error("Opportunity export missing ContactId");
  // An absent SF relationship is not authority to erase locally collected identity.
  if (!contactSfId) return {};
  const contact = contacts.get(contactSfId);
  if (!contact) throw new Error("Opportunity primary contact has not been imported; sync contacts first");
  return { primaryContactId: contact.id, dateOfBirth: contact.birthdate, contactSsn: contact.ssn };
}
