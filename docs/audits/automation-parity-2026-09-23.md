# Workflow automation parity audit — 2026-09-23

Scope: functional workflow automation comparison, not customer-data reconciliation. Audit only; no production rules, memberships, or application behavior changed.

## Evidence and limits

- Live Salesforce Setup → Flows inspected in the authenticated org at https://cdcrm.my.salesforce-setup.com/lightning/setup/Flows/home. The page showed “50+ items”; the visible alphabetical list is not the complete inventory. Active unmanaged workflows listed below were observed live.
- Exact rule details below come from the existing June 4, 2026 metadata export in `docs/sf-export/sfdx-raw/flows/`. This is a baseline, not a fresh retrieval of every deployed version. Recheck current rule bodies and recipient mappings before implementing them.
- Live CRM `/automation/flows`: three flows (Leave reviw, Bar, Welcome), all inactive, each with zero runs. This does not imply coded triggers are absent.
- Live CRM `/approvals/processes`: no configured approval processes.
- Live CRM `/settings/validation-rules`: zero configured rules across six entities. Fixed schema and entity validation still exist.
- CRM source reviewed at HEAD `d91c2aa5`. No production records were created or modified to test dispatch.

## Confirmed differences

| Priority | Area | Salesforce evidence | CRM evidence and gap |
|---|---|---|---|
| 1 | Record-save automation | Active record-triggered Lead and Case flows visible live | Main lead create/update and case create/update endpoints use raw Prisma writes, bypassing the manual trigger wrapper that invokes configurable validation and flow dispatch. Fix and test these entry points before configuring equivalent workflows. |
| 2 | Customer-support case approvals | Active `Case Trigger Flow`; exported `Case_Trigger_Flow.flow-meta.xml` submits new Customer Support cases of specified payment, refund, cancellation, and related types to `Case_Approval_Process` | Approval engine exists, but live CRM has no configured processes. Case create/update routes and case trigger module do not submit automatically. Exact current approvers and approval steps still require inspection. |
| 2 | Opportunity cadence enrollment | Active `Assign Welcome Call Cadence` and `AssignToContractSignedCadence` | Cadence enrollment engine exists, but its only runtime caller is the manual enrollment API. No opportunity-triggered enrollment found. Exported welcome flow schedules enrollment one day before the welcome call; contract flow enters at Closed Won First Payment Pending. Both target the account's primary contact; CRM enrollment currently accepts lead/opportunity/account, not contact. |
| 2 | Web-lead routing | Active `Assign Web Leads to Seth` | No equivalent source-based routing found in reviewed runtime code. Lead creation accepts the supplied owner or null. Exported flow selects an active user by email and handles a list of web/inbound sources, subject to the trigger-disable setting. Confirm current recipient mapping before porting. |
| 2 | Agent location derivation | Active `Assign Agent Location`; exported before-save flow derives location from the assigned fronter's user-country field | Agent location is displayed/imported, but no corresponding runtime derivation was found. Imported field values alone do not reproduce ongoing behavior. |
| 3 | Visual flow capabilities | Exported active rules use related-record lookups, subflows, cadence enrollment, and approval submission | Current node set is start, decision, update record, create task, send email, send SMS, wait, end. The missing operations need code integration or node support to reproduce these rules. |

## Source pointers

- Raw lead writes: `src/app/api/leads/route.ts:85`, `src/app/api/leads/[id]/route.ts:220` (other branches also write directly).
- Raw case writes: `src/app/api/cases/route.ts:43`, `src/app/api/cases/[id]/route.ts:50`.
- Manual wrapper and dispatch: `src/lib/triggers/runner.ts:65` and `:91`; `src/lib/prisma.ts` has no automatic Prisma trigger extension.
- Case configurable validation: `src/lib/triggers/case-trigger.ts:17` and `:23`.
- Cadence enrollment: `src/lib/cadences.ts`; caller `src/app/api/cadences/enroll/route.ts:15`.
- Existing approval implementation: `src/lib/approvals/engine.ts`.
- Visual flow node definitions: `src/lib/flow/nodes.ts`; execution: `src/lib/flow/executor.ts`.
- Baseline metadata: `Case_Trigger_Flow.flow-meta.xml`, `Assign_Welcome_Call_Cadence.flow-meta.xml`, `AssignToContractSignedCadence.flow-meta.xml`, `Assign_Web_Leads_to_Seth.flow-meta.xml`, `Assign_Agent_Location.flow-meta.xml` under the export path above.

## Present, intentional, or not yet verified

- Existing flow execution, decisions, tasks, messaging, waits, reentry controls, run traces, approval engine, cadence engine, and configurable validation should be extended where necessary, not rebuilt wholesale.
- Automatic welcome email on conversion was deliberately disabled June 24 per an earlier request (`src/lib/triggers/email-automation.ts:58`). Preserve that exception.
- Salesforce first-payment/back-office notification flows are active, but their full caller chains, recipient mappings, and current CRM equivalence require further audit. The CRM `onFirstPaymentCleared` helper has no runtime caller; that alone does not establish the full notification gap.
- Live zero configurable validation rules is a configuration observation; exact Salesforce validation-rule parity has not yet been audited.
- Scheduled polling endpoint exists; external cron configuration was not verified.
- Salesforce approval definition steps, all remaining flows, Apex automation, legacy workflow rules, and current deployed rule bodies remain outside this initial pass. Inactive source flows and installed templates are not requirements to activate.

## Validation and implementation order

Existing focused tests passed: 5 files, 48 tests (`flow-reentry`, `flow-tree`, `flow-email-node`, `validation`, `lib/cases`). These verify existing components, not production dispatch or complete Salesforce parity.

First repair and regression-test lead/case dispatch with mocked side effects, checking for duplicate executions and existing intentional behavior. Then inspect current source definitions and map recipients, implement the confirmed case/cadence/lead rules, and compare both systems against the same scenarios before deployment. This audit does not certify complete CRM parity.
