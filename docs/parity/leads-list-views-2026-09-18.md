# Leads list view audit — September 18, 2026

Reference: signed-in Coastal Salesforce Leads list picker and the filter sidebar for every saved list. The picker exposed 57 unique views. Definitions live in `src/lib/lead-list-catalog.ts`; every definition is compiled and exercised in PostgreSQL tests. Shared Leads explicitly uses `1 AND 2`.

Important differences preserved:

- My Leads excludes Archive Disposition; it is not the old CRM's differently defined My Open Leads.
- My Team Leads is a fixed saved last-name filter, intersected with CRM record access.
- Chris David Leads uses first name Christopher. David Medina Leads filters only on last name.
- Evgeny Nozdrin, Joe Mcdonald, and Jovana Pavlovic views filter Closer, not record owner.
- Tatiana Web leads filters owner last name Reyes.
- Un-Assigned Web Leads has six filters, including two specific owner usernames. It does not mean null owner.
- All Transferred Web Leads uses category `Web Lead`, not `Web`. The current category formula never produces `Web Lead`, and the reference list has zero rows.
- Web Leads Archive filters name containing New Splashpage Inbound and Business record type; it does not filter archived status.
- Recently Viewed and Recently Viewed Leads both have the special Recently Viewed owner scope.

Reference IDs, read from User / Queue detail links:

| Creator alias | User ID prefix |
| --- | --- |
| bbizc | 0058Y00000DE2LS |
| wlead | 0058Y00000DE2L8 |
| treye | 005VO0000008yv3 |
| AMupp | 0058Y00000CELzc |

Closer Pool queue: `00GVO000005sF0q`. Prefix matching accommodates both 15- and 18-character imported IDs. These mappings only resolve imported filter fields; they never grant access.

The source-category formula and field API names were cross-checked against the saved object describe export. Calendar filters use Eastern boundaries converted to UTC, matching the org rather than the application server timezone.

## CRM behavior

All views intersect the authenticated user's current record scope. Searches, URL filters, and saved filters combine with AND. Queries bind all values and reject unknown authorization shapes. Counts cap at 2,000. Table and board use the same filtered record set.

Ordinary lead lists exclude converted records; viewing history can still surface them. See [converted-lead visibility](https://help.salesforce.com/s/articleView?id=sf.leads_view_edit_converted.htm&language=en_US).

Recently Viewed now uses per-user persistent viewing history, written only after opening a record in the browser, not on Next.js prefetch. Existing Salesforce browsing history is not imported. New history starts empty with a link to All Leads. Pinning and recent list choices are stored per user in this browser.

Recently Viewed has the reference's ten columns: Name, Lead Id, Company, Phone, Lead Status, Lead Source, Total Debt Amount, Owner Alias, Sub Disposition, Created Date. Missing imported aliases display a dash. Other saved lists retain the existing CRM columns; this change does not claim full parity for every Salesforce toolbar action or custom column layout.

Schema additions are additive: viewing history and list sort indexes. The existing deployment startup applies the schema with Prisma. PostgreSQL tests use temporary fixture tables in an isolated local database, never production records.
