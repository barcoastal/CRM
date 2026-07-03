# Salesforce → CRM Gap Analysis (2026-07-03)

Audit of all 463 non-test custom Apex classes + 29 triggers + LWCs in the SF org
(`bar@coastaldebt.com` / cdcrm) vs the Next.js/Prisma CRM at `~/debt-settlement-app`.
SF source retrieved via `sf project retrieve` (see this folder). Done by 5 parallel
agents across feature areas.

## CRITICAL — money movement / integrations

1. **Outbound processor sync (the entire PUSH side).** The CRM only PULLS balances +
   draft status from RAM/SAS. It never pushes: create client, create bank account,
   set/add/update/cancel drafts, settlement schedules, payee accounts, customer
   status (cancel), or contract upload. `api/accounts/[id]/sync-processor` is a mock
   TODO. SF: `ProcessorCreateAPI`, `SASApi`, `RAMApi`, `ProcessorAPI`, `BatchSyncDrafts`,
   `ProcessorSyncQueueable` (40-draft chunked queueable chaining + Sync_Status state
   machine). **Without this, nothing the CRM schedules ever reaches the processor.**
2. **Async operation framework** (dispatcher + batch processor). SF `AsyncOperationService.initiateAsyncOperations`
   routes op-types to `IAsyncOperation` handlers; `Batch_ProcessAsyncOperations` drains
   PENDING on a schedule; `Async_Operation_Retry_Config__mdt` governs retry/dedupe. Our
   `async-op.ts` only records status. Most integrations below hang off this.
3. **Legal-network callouts (Citadel + VLP).** Sending the signed client/contract to the
   legal network is a no-op (stubbed "Skipped" in account/lead triggers). SF: `AsyncOpCitadelAPI`,
   `CitadelAPICallout`, `AsyncOpLegalNetworkCommunication` (Citadel-vs-VLP routing + store external id).
4. **Per-fee child `Fee__c` records + `Debit_Schedule__c` grouping.** SF explodes each draft
   into Retainer/Setup/Processor/Service/Program/Citadel fee rows and groups drafts by amount.
   These feed both PaymentSummary rollups and the SAS payout/debit-schedule payloads. CRM computes
   fees in-memory only → downstream payouts/summaries unbuildable. SF: `DraftFeesService`, `Batch_CreateChildFeeIds`, `DebitScheduleService`.

## HIGH — revenue / ops workflows

5. **Web-lead dedup against ACTIVE opportunities.** When an existing client re-submits a web
   lead, SF archives it as duplicate, notifies the opp owner (bell + email), and drops a "call the
   client" task. CRM only dedups lead-vs-lead. Revenue-protection. SF: `LeadDeDuplicationHandler`.
6. **Commission engine** — tier-by-debt-amount rates, Agent Monthly Tier + Agent Weekly Payroll
   schedulers (draft→finalize→rollover). Entirely absent. SF: `CommissionService`, `AgentMonthlyScheduler`, `AgentWeeklyScheduler`.
7. **Disposition routing** — High UCC Risk → convert opp to Buyout + reassign closer + cascade owner
   to Account & Contacts; Buyout-Not-Qualified → back-office reassign; processor status sync on
   client-status change. CRM has flags only. SF: `DispositionController`, `DispositionHelper`.
8. **Configurable onboarding checklist** — auto-generates checklist-item Tasks from config per
   stage/category with owner-by-role + due-date offsets. PathGuidance ≠ this. SF: `ChecklistSvc`.
9. **Five9 disposition-driven auto-redial cadence** — per-disposition redial delay, hopper priority,
   min/max attempt count, final-stage archive. CRM's step-based CallCadence is a different concept.
   SF: `Batch_Five9CallCadence`, `Redial_Cadence__mdt`.
10. **Settlement engine depth** — down-payment-first-then-spread, frequency date sequencing
    (Monthly/Twice-Monthly/Weekly w/ month clamp), wire/payment-method fees, running-balance
    simulation. CRM accepts an offer only. SF: `SettlementPaymentCalculator`, `SettlementPaymentsController`.

## MEDIUM — collectively significant

- **Contract file sync to processor** (uploadContracts) — signed contracts never pushed to RAM/SAS.
- **RedTrack postbacks** — missing events (qualification, contract sent, first payment), per-leadSource
  endpoints, clickId+event dedupe.
- **IPQualityScore live phone-fraud check** — currently display-only from imported data; no live call.
- **SMS templates + SMS→activity-Task logging** — no reusable object-scoped templates; SMS siloed from timeline.
- **Account graduation status** — `graduatedStatus` field exists but nothing computes Fully/Partially from settled debts.
- **Quote savings-comparison PDF + Buyout Send-Contract flow** (`GenerateQuotePdfController`, `BuyoutSendContractController`).
- **Document lifecycle** — leftover unsigned-contract cleanup, structured file naming + dual Account/Opp link + upload task, Closed-Won file rollup, closer-notes rollup + email alert.
- **Email opt-out self-service link** (encrypted, unsubscribe landing) — compliance risk.
- **Reschedule already-paid-months skip-set** + completed-amount validation (don't re-charge monthly bank/citadel for paid months).
- **Individual identity object**, **AccountTeamMember checklist reassignment**, **Share-to-MCA callout**, **MCA Lender API**, **campaign-member append + Five9 sync**, **shared HTTP callout+logging layer**.

## Well-covered (parity confirmed)

Payment-schedule math (term×4−1, citadel $145, setup $850/$995), escrow balance pull, draft-status
pull, e-sign completion (signed date, Document creation, bank-change status), Five9 agent dialer +
login state machine + click-to-call, Five9 call-log ingestion, inbound SMS (SMS Magic), email
send/inbound + templates, web-to-lead intake, Calendly, lead lifecycle/archive, ad-click-id capture.
