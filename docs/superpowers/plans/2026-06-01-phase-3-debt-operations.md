# Phase 3: Debt Operations Domain

**Goal:** Model the full debt-settlement payment + negotiation flow as Salesforce does it. Today the CRM has flat `Debt → Negotiation → Payment` rows; SF has 9 specialized entities that capture program plans, scheduled debits, individual ACH draft attempts, creditor offers, accepted settlements, fees, and rolling aggregates.

**Why this matters:** This is the operational heart of the business. Closers create the program → Back Office runs the drafts → Negotiators secure settlements → Payment Processor moves money → CSAs handle case escalations. Without proper models for each, the CRM can't replace Salesforce for the day-to-day workforce.

**Scope:** 9 new Prisma models + a refactor of Debt to plug into the new graph. Keep existing `Negotiation`, `Payment`, `Client` models alongside for backwards-compat (retired in a later phase). Endpoints + tests + sample seed data. No UI this phase (Phase 3.x).

---

## What changes

### New Prisma models

| Model | Purpose | Key fields |
|---|---|---|
| `PaymentProcessor` | Lookup entity for processors that service plans (RAM, Reliant, Global Holdings, etc.) | name, code, isActive |
| `ProgramPlan` | The signed enrollment that ties an Account to a product, term, monthly draft, processor | accountId, opportunityId, recordType, term, monthlyAmount, processorId, status, startDate |
| `DebitSchedule` | The recurring schedule that generates Drafts (e.g. "1st of month for 36 months") | programPlanId, dayOfMonth, frequency, startDate, endDate, nextRunDate |
| `Draft` | One individual ACH draft attempt (a single pull from client's bank) | programPlanId, debitScheduleId, scheduledDate, amount, status, attemptNumber, processorRef, returnCode |
| `Offer` | A creditor's settlement proposal (or our offer to them) | debtId, direction, amountOffered, percentOffered, expiresAt, status |
| `Settlement` | An accepted settlement on a Debt — produced when an Offer is accepted | debtId, offerId, recordType, settledAmount, savingsAmount, settledDate, payoffSchedule |
| `Fee` | A fee charged on a ProgramPlan (setup, monthly admin, settlement-success fee) | programPlanId, recordType, amount, chargedDate, status |
| `PaymentSummary` | Rolling aggregate of all payments on an Account | accountId, totalCollected, totalDisbursed, totalFees, lastUpdated |
| `FinancialSummary` | Point-in-time snapshot of an Account's income/expense profile (used at intake to compute affordability) | accountId, opportunityId, monthlyIncome, monthlyExpenses, disposableIncome, capturedAt |

### Modified models

```prisma
model Debt {
  // ADD:
  programPlanId String?
  programPlan   ProgramPlan? @relation(fields: [programPlanId], references: [id])
  // (creditorId already added in Phase 2)
  offers        Offer[]
  settlement    Settlement?  // 1:1 once accepted
}

model Client {
  // ADD (legacy alongside Account):
  programPlanId String? @unique
  programPlan   ProgramPlan? @relation(fields: [programPlanId], references: [id])
}

model Negotiation {
  // ADD (link to specific Offer when this activity drove one):
  offerId String?
  offer   Offer? @relation(fields: [offerId], references: [id])
}
```

### Record-type enums

- `ProgramPlan.recordType`: `DEBT_SETTLEMENT` | `BUYOUT` | `RESTRUCTURE` | `LIMITED_ASSET_PROTECTION` (matches Opportunity record types)
- `Settlement.recordType`: `STANDARD` | `LITIGATION` | `BUYOUT` | `WORKOUT` (SF Settlement__c had record types — capture the same shape)
- `Fee.recordType`: `SETUP` | `MONTHLY_ADMIN` | `SETTLEMENT_SUCCESS` | `CANCELLATION` | `OTHER`
- `Offer.direction`: `FROM_CREDITOR` | `FROM_US` (track who proposed)
- `Draft.status`: `SCHEDULED` | `PROCESSING` | `SUCCESS` | `FAILED` | `RETRYING` | `CANCELLED`

### Status state machine for Draft (the most stateful entity)

```
SCHEDULED ──run→ PROCESSING ──webhook(success)→ SUCCESS
                            ──webhook(failure)→ FAILED ──retry rules→ RETRYING ──run→ PROCESSING
                                                       └─ max retries reached → FAILED (terminal)
                            ──manual cancel  → CANCELLED
SCHEDULED ──manual cancel→ CANCELLED
```

Retry rules: 3 attempts total, 5 business days between each. After 3 failures the Draft enters terminal FAILED and a Case is opened (Phase 5).

---

## File map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add 9 models, modify Debt/Client/Negotiation |
| `src/lib/record-types.ts` | Modify | Add ProgramPlanRecordType / SettlementRecordType / FeeRecordType + isValid helpers |
| `src/lib/draft-state-machine.ts` | Create | Pure state-machine for Draft transitions + retry scheduling |
| `src/lib/debit-schedule.ts` | Create | Pure function: given a DebitSchedule, generate the list of upcoming Draft dates |
| `src/lib/payment-rollup.ts` | Create | Pure aggregators for PaymentSummary fields |
| `src/lib/settlement-acceptance.ts` | Create | Transactional acceptOffer(offerId) → Settlement; updates Debt.status |
| `src/lib/validations/program-plan.ts` | Create | Zod |
| `src/lib/validations/draft.ts` | Create | Zod |
| `src/lib/validations/offer.ts` | Create | Zod |
| `src/lib/validations/settlement.ts` | Create | Zod |
| `src/lib/validations/fee.ts` | Create | Zod |
| `src/lib/validations/payment-processor.ts` | Create | Zod |
| `src/app/api/program-plans/route.ts` | Create | GET list / POST create |
| `src/app/api/program-plans/[id]/route.ts` | Create | GET/PATCH |
| `src/app/api/program-plans/[id]/drafts/route.ts` | Create | List drafts for a plan |
| `src/app/api/program-plans/[id]/fees/route.ts` | Create | List + charge fees |
| `src/app/api/drafts/[id]/route.ts` | Create | GET + state transition actions |
| `src/app/api/drafts/[id]/retry/route.ts` | Create | POST → reschedule a failed draft |
| `src/app/api/debts/[id]/offers/route.ts` | Create | GET list + POST create |
| `src/app/api/offers/[id]/route.ts` | Create | GET + PATCH |
| `src/app/api/offers/[id]/accept/route.ts` | Create | POST → produces Settlement |
| `src/app/api/offers/[id]/reject/route.ts` | Create | POST → updates status |
| `src/app/api/settlements/route.ts` | Create | List for a Debt/Account |
| `src/app/api/settlements/[id]/route.ts` | Create | GET + PATCH (notes, scheduled payoff date) |
| `src/app/api/fees/route.ts` | Create | List + charge |
| `src/app/api/payment-processors/route.ts` | Create | List + create (admin) |
| `src/app/api/accounts/[id]/financial-summary/route.ts` | Create | Get latest + create snapshot |
| `src/app/api/accounts/[id]/payment-summary/route.ts` | Create | Get computed rollup |
| `src/lib/permissions.ts` | Modify | Add new perm keys (already partly there: ProgramPlan, Offer, Settlement, Draft, Fee) |
| `prisma/seed.ts` | Modify | Seed 3 processors, 2 active ProgramPlans tied to existing sample accounts, 6 sample drafts (mixed statuses), 2 offers, 1 settlement, 1 fee, 1 financial summary |
| Tests: `tests/lib/draft-state-machine.test.ts`, `tests/lib/debit-schedule.test.ts`, `tests/lib/payment-rollup.test.ts` | Create | Pure-logic tests |

---

## Execution order

1. **Schema** — add 9 models + modify Debt/Client/Negotiation. `prisma generate`.
2. **Record types** — extend `record-types.ts` with new enums + tests.
3. **Draft state machine** — pure module (`nextStatus(currentStatus, event) → newStatus | error` + retry-date calculator) with tests.
4. **DebitSchedule generator** — pure function `generateDraftDates(schedule, until)` with tests.
5. **PaymentRollup** — pure aggregator over Draft[] / Fee[] / Settlement[] → totals.
6. **SettlementAcceptance** — transactional offer → settlement → debt status update.
7. **Validations** — Zod schemas for 6 entities.
8. **API endpoints** — built in dependency order: PaymentProcessor (lookup) → ProgramPlan → Draft (per-plan) → Offer → Settlement → Fee → financial/payment summary.
9. **Seed** — sample data covering each state.
10. **Push to main** → Railway auto-applies schema → curl `/api/debug/seed` → smoke each endpoint.

---

## What we do NOT do this phase

- UI (Phase 3.x — add ProgramPlan card to Account detail, Draft retry button, Offer acceptance modal)
- Real ACH integration (Drafts are state-only — no actual money moves; webhook stubs)
- Backfill from existing `Negotiation` rows into new `Offer`/`Settlement`
- Retire `Client` model
- Multi-currency support (USD only)
- Tax handling (separate phase if ever needed)

---

## Definition of done

- [ ] `prisma db push` applies on Railway
- [ ] Sample seed creates 2 program plans with drafts in multiple states
- [ ] Draft state machine tests cover all transitions + retry math
- [ ] DebitSchedule generator produces correct upcoming-draft dates for monthly + bi-weekly cadences
- [ ] Settlement acceptance is transactional (no half-states)
- [ ] All endpoints permission-checked via Phase 1 keys
- [ ] All existing tests still pass; new tests pass; target ≥65 tests after Phase 3
