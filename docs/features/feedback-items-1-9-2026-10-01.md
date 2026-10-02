# Feedback items 1–9 — October 1, 2026

Scope: finish the remaining implementation gaps in the first nine feedback items. The user explicitly deferred item 4 and asked to leave it New. At the user's request, items 1, 2, 3, 5, 6, 7, 8 and 9 were marked Done; item 4 remains New.

| Item | Result |
| --- | --- |
| 1. Month quote table and split window | Program Recalculate now compares terms in a table with weekly/monthly estimates, program cost and savings. View Split opens a read-only window. Edit Split validates dates, cents, fees and the full retainer/setup total. The move-upcoming-drafts choice persists. Calculator, opportunity summary and quote use one projection, excluding summary/skipped rows from collected totals. |
| 2. Assign negotiator dropdown | Already implemented. Rechecked assignment authorization, selected-user validation, stale-update protection and audit coverage. |
| 3. Log wire payment | Already implemented. Rechecked amount/date/reference/fee validation, duplicate prevention, permissions and completed-wire accounting without an outgoing debit. |
| 4. New status for added debt | Deferred at the user's request; remains New. No additional payment/lifecycle status was invented. |
| 5. Show all notes | Already implemented. Account Notes expands beyond the first six entries. |
| 6. Amend opportunity | Already implemented. Rechecked debt/payment changes, revision conflict detection, amendment history and protections for finalized records. |
| 7. Lead account link | Already implemented. Explicit linked accounts are preferred, record access is enforced, and ambiguous names do not create a guessed association. |
| 8. Branded client quote | Now includes saved split/edited/deferred payment dates and amounts, exact cents and payment count. Preview data resets on reopen. Sending an outdated quote is rejected. Retries share provider/activity idempotency keys; failed delivery is not logged as a completed email. Existing company/marketing copy is retained. |
| 9. Debt status/frequency | Current, Default and Reprieve remain the payment statuses; new frequencies are Daily, Weekly and Monthly. Save endpoints validate the choices, preserve unchanged imported legacy frequencies, and require opportunity edit permission and record access. Editing a creditor no longer resets current/enrolled balances. |

## Where to use the changes

- Opportunity → Payment Calculator → Recalculate: compare program lengths and apply a term.
- First calculation row → Edit Split / View Split: edit or inspect retainer/setup installments. Save calculation to persist them. Applying a new split replaces individual draft edits; Reset draft edits clears added/edited/deferred drafts when needed.
- Get Quote → Review payment dates and amounts: inspect the saved schedule before sending. Save calculator changes before opening the quote.
- Account → payment calculation: loads the same saved debt amount, term, Citadel fee and first date as the opportunity.

## Validation

- 132 tests across 14 focused suites passed: calculator persistence and concurrency, projections, quotes and mocked delivery, debt create/edit validation/access, wire recording, amendments, negotiator assignment, account navigation, and manual/automatic splits.
- 27 schedule and draft-engine tests also passed with `TZ=America/New_York`, including DST and weekend date checks.
- Read-only production checks of four opportunities referenced in feedback confirmed quote totals equal the sum of their payment schedules. Item 4 remains `NEW`.
- Production build passed. The release also preserves the Salesforce signing pilot merged concurrently to main.
- October 2 browser verification completed with headless Chrome against the production application build and a separate PostgreSQL QA database. All eight completed feedback workflows passed: term comparison and split save/reload, negotiator assignment, wire receipt/ledger, all notes, opportunity amendments/history, lead account navigation, saved-schedule quote delivery, and debt status/frequency saves.
- Additional checks passed: exact-cent quote dates/amounts, outdated quote rejection, idempotent wire retries, duplicate wire-reference rejection, completed-payment preservation, read-only mutation denial, and quote record access. Email delivery was captured locally; real provider delivery and processor execution were not tested. No real client emails or debits were sent, and no production financial records were edited.
- Browser inspection found a payment date bug: US timezones displayed a UTC-midnight payment on the previous date, and weekly split suggestions could lose a day at the spring daylight-saving transition. The live payment grid and split dialog now format and advance calendar dates in UTC. Six browser regression checks reproduced the failures before the fix and passed afterward in America/New_York, including wire dates, amended dates, and both ways to add weekly split installments.
- The follow-up release passed its production build and 64 focused tests, including three new rendering regressions run with TZ=America/New_York. Saved-split and quote workflows were also rerun after incorporating the latest shared signing changes.
- No schema migration is required. Changes apply to saved calculations/quote presentation; existing scheduled debits are not automatically regenerated.
