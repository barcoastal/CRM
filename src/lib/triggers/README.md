# Trigger Harness

Ported from Salesforce's Apex trigger pattern (29 triggers across Lead /
Opportunity / Account / Draft / Fee / Offer / Task / etc.).

## How it works

Each trigger lives in `src/lib/triggers/<entity>-trigger.ts` and exports:

```ts
export const leadTrigger: Trigger<Lead> = {
  beforeInsert: async ({ next, ctx }) => { ... },
  beforeUpdate: async ({ next, prev, ctx }) => { ... },
  afterInsert:  async ({ row, ctx }) => { ... },
  afterUpdate:  async ({ row, prev, ctx }) => { ... },
  afterDelete:  async ({ row, ctx }) => { ... },
};
```

- `next` (before*): the values being written — mutate in place to derive fields
- `prev` (update/delete): the row as it was before the change
- `row` (after*): the saved record (post-commit)
- `ctx`: Prisma client + session user id

Wire each trigger by importing it into `src/lib/triggers/registry.ts` so the
Prisma extension fires them automatically on every `.create()` / `.update()` /
`.delete()` call.

## SF → CRM mapping

| SF Trigger | TS port | Status |
|---|---|---|
| LeadTrigger | `lead-trigger.ts` | partial |
| OpportunityTrigger | `opportunity-trigger.ts` | TBD |
| accountTrigger | `account-trigger.ts` | TBD |
| draftTrigger | `draft-trigger.ts` | TBD |
| feeTrigger | `fee-trigger.ts` | TBD |
| offerTrigger | `offer-trigger.ts` | TBD |
| paymentSummaryTrigger | `payment-summary-trigger.ts` | TBD |
| docusignEnvelopeStatusTrigger | `docusign-status-trigger.ts` | TBD |
| FirstPaymentTrigger | `first-payment-trigger.ts` | TBD |
| TaskTrigger | `task-trigger.ts` | TBD |
| EventTrigger | `event-trigger.ts` | TBD |
| emailMessageTrigger | `email-message-trigger.ts` | TBD |
| smsTrigger | `sms-trigger.ts` | TBD |
| contactTrigger | `contact-trigger.ts` | TBD |
| debtDetailsTrigger | `debt-details-trigger.ts` | TBD |
| opportunityContactRole | `opportunity-contact-role-trigger.ts` | TBD |
| accountTeamMemberTrigger | `account-team-member-trigger.ts` | TBD |
| contentDocumentLinkTrigger | n/a | skip |
| ContentDocumentTrigger | n/a | skip |
| quoteTrigger | n/a | skip (no Quote model) |
| SuppressionListTrigger | `suppression-list-trigger.ts` | TBD |
| AsyncOperationTrigger | n/a | already handled in AsyncOp service |
| ApplicationEventTrigger | n/a | already handled in audit log |
| Five9CallLogTrigger | `five9-call-log-trigger.ts` | TBD (Phase D) |
| SMSMagicTrigger | n/a | superseded by Twilio |
| AgentMonthlyTierTrigger | `agent-tier-trigger.ts` | TBD (Phase G) |
| ProgramPlanTrigger | `program-plan-trigger.ts` | TBD |
| OpportunityLineItemTrigger | n/a | skip |
| checklistTrigger | `checklist-trigger.ts` | TBD |

## Anti-recursion

Each trigger gets a `ctx.skip` set that the harness checks to prevent self-recursion.
