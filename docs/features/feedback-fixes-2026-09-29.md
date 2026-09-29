# CRM feedback fixes

The remaining actionable feedback now has these implementations:

- Account Activities lists every imported note behind **Show all notes**. Note documents keep their existing access-checked links.
- Lead company names link to the accessible related account. Explicit conversion/opportunity/Salesforce relationships take precedence; unique exact EIN/name matches are a fallback. Ambiguous matches open filtered account search.
- Closer archive visibility is enforced by shared opportunity record scope, including archived-finalized and legacy stage spellings, covering lists, search and record APIs. Account opportunity collections use that scope too. Explicit archived-view grants still apply.
- **Log Wire Payment** records received money, using receipt date, unique account/reference, gross amount, fee, net escrow, Regular/Settlement type, legal-fee indicator and notes. It creates a completed WIRE draft, account activity and audit record atomically. It never queues a debit. Account.Edit, Draft.Retry and account access are required. Receipt retries and duplicate references are protected.
- Opportunity calculators retain calculation inputs, splits, row edits, skips and inserted rows. Saving checks the latest calculation to reject stale writes. The opportunity now also exposes existing active-plan drafts through the persistent payment grid. Calculation saving does not submit a new debit schedule.
- **Amend Opportunity** opens an editor for debts, new debts, term and pending payment dates/amounts. A serializable transaction validates the revision, updates records and totals, increments the version and records before/after history. Completed payments and finalized debts are protected. Payment changes require Draft.Retry and use the existing processor sync queue. Debt and term changes regenerate the calculation; upcoming amounts are explicitly editable rather than automatically overwritten.

Salesforce exported field definitions confirm debt statuses Current/Default/Reprieve, debt frequencies Daily/Weekly/Monthly, and wire types Regular/Settlement. Existing imported legacy values are preserved when unchanged. The feedback asking for an additional debt status does not name the requested value and remains awaiting clarification. The QA entry `zssni` contains no requirement.

Database change: one nullable JSON calculation column plus the WirePayment table, indexes and foreign keys. No existing financial records are rewritten by the migration.

Validation covers archive scope, account resolution, wire validation and duplicate requests, real PostgreSQL-compatible migration constraints, persisted calculation state, amendment concurrency and protected financial records. Production checks open forms and read records without sending quotes or submitting financial changes.
