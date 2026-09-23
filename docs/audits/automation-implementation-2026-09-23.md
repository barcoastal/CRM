# Automation implementation — September 23, 2026

Status: implemented and tested locally; not deployed. This extends the initial automation parity audit, rather than certifying complete parity.

## Implemented

- Main lead/case saves, inline edits, and applicable bulk operations now invoke validation and automation hooks. Scoped updates retain their access predicates. Lead enrollment and associated client/payment creation are transactional.
- Eligible support cases submit to a queue approval process, lock ordinary editing while pending, route approved cases to CS L1, and return rejected cases to their creator. Submission and decisions use transaction locks to prevent duplicate requests/decisions.
- Opportunity changes support Welcome Call scheduling one day before the appointment and Contract Signed enrollment upon entering Closed Won First Payment Pending. Enrollment targets the account primary contact, checks configured steps, and deduplicates enrollment and worker execution.
- Audited web sources route new leads to the configured active owner. Changed fronter assignments derive agent location from the dedicated user-country field. Missing mappings preserve existing values.
- Automation settings expose configuration readiness. The intentionally disabled conversion welcome email remains disabled.

## Live source verification

The signed-in Salesforce session exposed active Case Approval Process `04aVO000001qjtJ`: Case Owner submits; administrators alone edit pending records; recall is disabled; the approval step uses CS Case Approvers; approval routes to CS L1; rejection returns to the creator.

Queue `00GVO00000RPUwD` lists Allison Biscardi (`0058Y00000CVGxw`) and Yeislee Flores (`005VO000000msis`). Initial CRM setup maps only active users with those source IDs. The live CRM queue currently has zero members; production mappings remain unverified. CS L1 source queue is `00GVO00000RPUwE`.

Both attempts to open the Cadences list with the signed-in user returned “You don't have access to this record.” The exact Welcome Call and Contract Signed step definitions were not readable. Enrollment rules use the previously exported metadata baseline; no cadence steps or message templates were invented.

## Remaining parity and release checks

- Obtain readable cadence definitions and configure their exact steps before claiming cadence parity.
- Verify production owner mappings, queue members, and custom user-country values. No production backfill or schema change was performed.
- Source approval email alerts/templates are not mirrored; existing CRM notifications remain in use.
- Specialized skip-payment financial operations, comment timestamp updates, and import/sync writes are outside the main-save integration. Imports deliberately do not replay these automations.
- Reconcile the latest remote changes and revalidate before deployment; this working tree is based on `d91c2aa5`.

## Validation

- Full unit suite: 81 files passed, 578 tests passed; 3 files/10 tests skipped, including opt-in database tests.
- Opt-in local PostgreSQL integration: 4 tests passed, covering case submission/locking/authorization/approval/rejection and cadence deduplication/due execution. Fixtures roll back; no customer records or outbound messages were used.
- Final focused routing, dispatch, and cadence suite: 17 tests passed after the last changes.
- Final TypeScript check and whitespace check passed. Modified-file lint passed before the final enrollment transaction refactor.
- Production webpack build passed with an 8 GB Node heap before the final scope-preservation and enrollment transaction refinements. A final release build is still required.
