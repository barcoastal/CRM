# Advanced reporting and dashboard release

This release extends the earlier report formulas, drill-downs and email-link schedules.

- Formula editor supports row arithmetic, IF comparisons (including status literals), elapsed date calculations and formulas evaluated from full/group totals. Up to ten formulas; no arbitrary code evaluation.
- Debt and Payment report types expose related opportunity/account fields. Accounts expose independently aggregated opportunity counts/amounts, debt balances and completed payment amounts. Independent child aggregation prevents multiplying balances by joined payment counts. Every parent/child query retains viewer permissions and record scope.
- Up to three grouping levels, with day/month/quarter/year date intervals and parent subtotals. Existing single-group reports remain compatible.
- Reports scan matching records in cursor batches inside a repeatable-read transaction. Totals, group counts, averages and charts cover all matches. Only displayed details are capped (up to 10,000). Averages exclude null values. Mixed JSON/scalar OR filters preserve their Boolean semantics. Unknown filters fail clearly.
- Dashboard-wide created/snapshot date range, owner and optional subordinate-team filters apply to saved-report tiles and built-in metrics. Filters intersect authorization; they cannot expand access. Fixed metric predicates (e.g. overdue or this month) still apply.
- Pipeline History captures one atomic daily observation per opportunity and UTC date; it starts after deployment and does not fabricate earlier history. Existing Opportunity Changes are separately reportable. Saved report dashboard tiles and reports offer trend-line charts and selectable measures.
- Schedule delivery supports a report link or CSV snapshot plus link. CSV snapshots save the observed results and attach two files: full-dataset summaries and configured detail preview. Saved snapshots are accessible from the report. No PDF attachment is implemented in this release.

## Access and operational limits

CSV creation/download requires Reports.Export. Recipients remain the subscribing user's CRM email. The worker rechecks access before sending, preserves the existing outbox leases and provider idempotency key, and records generation failures without sending incomplete data. Snapshot download/delivery conservatively reruns the saved definition and checks matching-record/related-record membership and permissions; changed membership prevents access to the older aggregate. Live report results remain available. A snapshot is therefore not an immutable audit archive with independent access grants.

Reports fail with an explicit narrowing request after approximately 110 seconds or 20,000 leaf groups; they do not present partial totals as complete. Cross-object related aggregates respect the underlying permissions, and missing permission yields blank aggregate values. Historical opportunity snapshots use current opportunity visibility. Daily pipeline history has no automatic retention deletion. Existing email-link schedules are unchanged; deployment creates no personal email schedules or test messages.

Additive schema: Report.options, ReportSubscription.snapshotFormat, ReportDelivery.snapshot, OpportunitySnapshot (opportunity/date unique key and capture-date index). Existing startup schema synchronization applies these fields/table.

## Verification

- TypeScript and scoped ESLint checks.
- Unit coverage for pagination beyond the detail limit, full/group summary formulas, three grouping levels, JSON OR semantics, IF/date calculations, dashboard filters, related sums, snapshot fingerprints/CSV, outbox snapshot persistence and access cancellation.
- Rollback-only PostgreSQL integration test against crm_parity_test: actual nested joins, scoped payments, hidden nested account redaction, permission exclusion, independent aggregates, SQL capture idempotency and historical totals.
- Production build and post-deployment health/UI smoke checks.

This supersedes the remaining-items list in reports-formulas-schedules-2026-09-23.md for these capabilities. Arbitrary expression languages and uncapped detail exports remain outside this release.
