# Flexible Payments Engine — Design (2026-07-09, approved by Bar)

## Problem
The payment model is rigid: identical weekly drafts, no splits, no operational
mutations. Bar needs (his words): payments over $10K split day-after-day with
the $55 service fee still charged once a week; skip a payment and push the
rest; charge a payment manually; change a payment's amount with the balance
reflected across the remaining payments — all in the payment calculator AND at
the merchant (processor).

## Principles
- The persisted Draft schedule is the single source of truth after enrollment.
  The calculator generates it; mutations operate on it.
- Every mutation marks affected drafts `processorSyncStatus = "PENDING"`. The
  (upcoming) SAS/RAM client drains that queue; until it ships, changes are
  visible in the CRM and flagged "pending sync".
- Money integrity: program totals never drift. Every mutation preserves
  sum(drafts) == program total unless the user explicitly changes the total.

## Rules
### 1. $10K split
A draft whose amount > $10,000 splits into consecutive BUSINESS-day children:
$10,000 chunks + remainder (e.g. $18,629.32 -> $10,000 Mon + $8,629.32 Tue).
Fee allocation across children in order: retainer -> setup -> program ->
escrow fill sequentially (SF child-record pattern). Service fee, bank fee and
legal (Citadel/Victory) fee attach ONLY to the first child — charged once per
week. Children share a `splitGroupId`; UI renders them as grouped sub-rows.

### 2. Skip & push
Skipping a pending draft sets status SKIPPED and shifts every LATER pending
draft forward one period (program extends by one period). Totals unchanged.
Processor: cancel skipped draft, re-date the rest.

### 3. Manual charge
"Charge now" creates a one-off Draft (kind = MANUAL) scheduled next business
day, synced to the processor immediately. It does not change scheduled drafts
unless the user opts to deduct it from the remaining schedule (phase 2).

### 4. Edit amount + rebalance
Changing a pending draft's amount redistributes the difference equally across
the LATER pending drafts (last draft absorbs rounding). Guards: no negative
drafts; a draft pushed over $10K re-splits. Fee columns rebalance
proportionally to the amount change on affected drafts' escrow portion —
fees stay attached to their original weeks.

## Schema (additive)
Draft gains: feeRetainer/feeProgram/feeSetup/feeService/feeBank/feeLegal/
escrowAmount (Float, default 0), splitGroupId + splitIndex, kind
(SCHEDULED|MANUAL), processorSyncStatus (NOT_SYNCED|PENDING|SYNCED|FAILED),
skippedAt. Status gains SKIPPED value (string field, no enum change).

## Components
- src/lib/payments/draft-engine.ts — pure functions: applyTenKSplit,
  planSkip, planAmountEdit, nextBusinessDay (+ unit tests in tests/).
- src/lib/payments/draft-mutations.ts — prisma transactions applying the
  plans to persisted drafts (skipDraft, editDraftAmount, manualCharge,
  generateDraftsFromSchedule).
- APIs: POST /api/drafts/[id]/skip, PATCH /api/drafts/[id]/amount,
  POST /api/program-plans/[id]/manual-charge.
- Calculator (reschedule-calculator): preview shows the $10K split as grouped
  sub-rows pre-enrollment; on a live plan the row actions call the real APIs.

## Build order
1. Engine + tests + schema (this commit)
2. Calculator preview split + live row actions
3. SAS client (test mode) -> drain PENDING queue
4. RAM client
