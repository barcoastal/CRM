# Account 2 view

Account records have a second detail tab, Account 2, beside Details. The original Details layout remains the default. Account 2 uses the same account access, masked SSN control, inline editing endpoints, and right-side cards.

The layout follows the supplied September 9 recommendation screenshot, with the confirmed correction that client name appears on the left and business name on the right. The business name is the account name; client name uses the account individual, primary contact, then the most recent visible opportunity. The opportunity owner comes from that same visible opportunity. A link identifies that opportunity when multiple records exist.

Sections:
- Client & Business: client/business names, account/opportunity owners, industry/phone, alternate name/alternative phone.
- Identifiers: SSN/EIN and lead number.
- Contact, Payments & Sync: last contact, call/email, SMS, legal network, processor status, total debt, sync/legal-network sync, sync date/time, bank sync/first sign date, first draft/first payment completed.
- Negotiation & Legal: negotiator, negotiation status, legal status.

Alternate Name was not a typed account field. It uses the existing custom-field storage and audited inline edit route under Alternate_Name__c, without a database migration. It starts empty when no value is saved. First Sign Date uses the native contract timestamp with an imported-date fallback; completed-payment date is shown when available, otherwise completion status.

No extra database queries are added for this view. Existing Details and other account panels are unchanged.
