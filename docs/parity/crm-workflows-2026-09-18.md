# CRM workflow parity release — 2026-09-18

Implemented:
- 57 lead view layouts verified against the signed-in source and live list metadata; 42 available columns, per-view preferences, saved private/shared views, cloning, renaming, deletion, filters and sorting controls.
- Lead CSV import with preview, validation, duplicate handling and record creation audit. Campaign membership from the selection toolbar and header, with duplicate suppression and scoped access.
- Account/opportunity viewing history and custom views. Account teams support manual membership and automatic closer membership from stable imported user IDs. Manual memberships survive sync; removed/reassigned closers lose automatic membership. Existing accounts can be reconciled with `scripts/backfill-account-closers.ts` (dry-run by default, `--apply` to update).
- Proposal endpoint now records and sends real messages, checks suppression and permissions, and returns delivery/configuration failures accurately. Existing negotiation Gmail sending is a separate route.
- Bounded administrative source-data comparison and missing-field repair; current CRM values are never silently overwritten. New imports preserve source timestamps and relationship fields.
- Lead payment health follows the verified live trigger rule, including null versus zero semantics. The integration profile hides the source checkbox, so the CRM derives it from all ten creditor debt/payment pairs.
- List, record and analytics access remain scoped; shared saved views do not grant record access or editing rights to the view definition.

Validation: 85 focused tests; full suite 466 passed, 5 skipped, with one pre-existing lead-conversion test failure (hyphen versus em dash in opportunity name). Changed-file lint has no errors. Local API workflow checks covered saved views, campaign membership, account teams, visit history, imports and the unconfigured proposal sender. No real email was sent during testing.

Scope: this release does not claim complete product parity. The live source contains 43 Account lists and 69 Opportunity lists; the existing account catalog and limited opportunity catalog still require a separate full filter/layout migration. Advanced intelligence/pipeline actions, source report definitions and every source automation are not all implemented by this release. Payment and membership behavior above were audited specifically; unsupported functionality must not be presented as completed parity.
