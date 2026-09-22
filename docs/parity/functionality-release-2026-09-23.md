# CRM functionality pass — 2026-09-23

## Implemented in this release

- Opportunity Pipeline Inspection: stage counts, amount and debt totals across the current scoped list; past-close-date and unchanged-record counts; stage drill-down links.
- Opportunity labels: persistent string-array field; bulk add/remove, exact-label filtering, visible column. Add is duplicate-safe; removal uses optimistic conflict checking and rolls back the transaction on a conflict. Edit permission and record scope are enforced.
- Account Intelligence: counts, current debt and escrow totals grouped by client status for the scoped, filtered list.
- Discover Companies: searches existing accessible CRM accounts by company, phone, email or EIN. This is internal search, not an external enrichment provider.
- New Account and New Opportunity pages. New accounts default to the creator as owner. Opportunity creation requires Create permission, an accessible lead, and an atomic create/lead-status transaction.
- Archive visibility now intersects every Opportunity view instead of being skipped when a view already supplies a stage condition.
- Existing lead-conversion name generation now matches the documented and tested em-dash convention.

## Verification

- Full suite: 480 passing tests, 5 skipped; no failures.
- Label integration against local crm_parity_test: default empty labels, duplicate prevention, filter, removal, concurrent-change protection. All test changes rolled back.
- Production build and TypeScript passed. Existing document-storage bundling warnings remain.
- Changed application files lint clean.

## Scope and remaining work

This release is not complete Salesforce product equivalence. Pipeline Inspection is a current-state summary, not historical pipeline-change tracking. Intelligence is an operational summary, not predictive scoring. Discovery has no external provider. Mass Update still offers Owner and Stage. Account import/data migration was excluded from the user's functionality-only request. Report formulas/subscriptions/cross-object behavior, automation/approval parity, field-level security, territories, and non-Lead health checks still require a source-backed audit and implementation. They must not be reported as completed by this release.

Schema change: one additive Opportunity.labels column with an empty-array default; no existing business fields are rewritten.
