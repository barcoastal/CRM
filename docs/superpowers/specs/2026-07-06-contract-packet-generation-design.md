# Contract Packet Generation — Design Spec (2026-07-06)

## Goal

Generate and e-sign a client's enrollment **contract packet** from Word (`.docx`)
templates, auto-filling the info the CRM already collects (client, program terms,
payment schedule, creditors), and routing to the correct agreements based on the
payment processor and legal network. One merged PDF, signed once — matching the
existing Salesforce packet (see the reference PDF the packet mirrors 1:1).

## Packet composition

A deal's packet is **2–3 agreements**, auto-selected, merged into one PDF:

1. **Coastal master agreement** — ALWAYS. A single multi-section `.docx` that
   bundles: the Business Debt Resolution & Settlement Agreement, the Summary page,
   the Program Payment Schedule (the calculator output), the Schedule of Enrolled
   Debts (creditor table), the Limited Power of Attorney, and the Hardship Affidavit.
2. **Processor agreement** — `SAS` if the deal's processor is SAS, `RAM` if RAM.
   (SAS = the Secure Account Service trust-accounting doc with bank debit
   authorization + debit schedule.)
3. **Legal agreement** — `CITADEL` or `VICTORY`, chosen by `resolveAgreement(creditors)`
   (all-VLP creditors → Victory, else Citadel). Reuse `src/lib/creditor-agreements.ts`.

## Template model

Extend the existing `EnvelopeTemplate` (Prisma) — or a sibling `ContractTemplate`:
- `category`: `COASTAL | PROCESSOR_SAS | PROCESSOR_RAM | LEGAL_CITADEL | LEGAL_VICTORY`
- Store the source **`.docx`** on the volume (new `docxPath`), keep `isActive`.
- Upload UI: reuse `templates/esign/new`; add a category selector; accept `.docx`.

## Merge mechanism — `.docx` templating (docxtemplater)

Author each agreement in Word with inline `{{tokens}}`. On generate: fill tokens
in the `.docx` via **docxtemplater** → convert to PDF via the existing
`src/lib/esign/docx-to-pdf.ts` (LibreOffice) → merge PDFs (`pdf-lib`).

### Token catalog (resolved from `buildMergeContextForOpportunity` + calculator)

Scalars: `{{ClientName}}` `{{ClientFirstName}}` `{{ClientLastName}}` `{{ClientAddress}}`
`{{ClientCity}}` `{{ClientState}}` `{{ClientZip}}` `{{ClientPhone}}` `{{ClientEmail}}`
`{{TotalDebt}}` `{{ProgramLength}}` `{{FirstPaymentDate}}` `{{FirstPaymentAmount}}`
`{{RetainerAmount}}` `{{DispensationFee}}` `{{SettlementPercent}}` `{{ProgramFeePercent}}`
`{{RetainerPercent}}` `{{SetupFee}}` `{{ServiceFee}}` `{{TotalWithFees}}`
`{{EstimatedSavings}}` `{{WeeklyPayment}}` `{{ProcessorName}}` `{{LegalNetwork}}`
`{{TodayDate}}` `{{AgentName}}`

Bank (SAS doc): `{{BankName}}` `{{Routing}}` `{{BankAccountNumber}}` `{{SSN}}` `{{DOB}}` `{{AccountType}}`

Repeating tables (docxtemplater loops):
- Enrolled debts: `{{#Creditors}} {{Balance}} {{CreditorName}} {{AccountNumber}} {{/Creditors}}`
- Payment schedule (calculator rows): `{{#Schedule}} {{Date}} {{Amount}} {{RetainerFee}} {{ProgramFee}} {{SetupFee}} {{ServiceFee}} {{BankFee}} {{LegalPlanFee}} {{SettlementAccount}} {{/Schedule}}`
- Debit schedule (grouped, SAS): `{{#DebitSchedule}} {{DepositAmount}} {{StartDate}} {{NumberOfPayments}} {{/DebitSchedule}}`

Numbers auto-format as USD, dates as `M/D/YYYY`. Missing values render empty
(never leave a raw `{{token}}`). Used tokens validated on upload.

**Payment-schedule + debit-schedule data** come from the same engine as the
reschedule calculator (`generateRescheduleSchedule`), so the contract's schedule
== the on-screen calculator. The `LegalPlanFee` column = the citadel monthly fee.

## Signatures

Reuse the SF DocuSign anchor convention already present in the docs:
`\s1\` (signature) · `\n1\` (print name) · `\d1\` (date) · `\i1\` (initials).
After LibreOffice → PDF, detect these anchor strings (PDF text position) and drop
the corresponding e-sign boxes there. Client signs once; the drawn signature /
initials stamp into every anchor across the merged packet. Fallback: if an anchor
can't be located, append a standard signature page.

## Generate & send flow

1. "Generate & Send Contract" on the opportunity → server action.
2. Route → ordered template list (Coastal + processor + legal).
3. For each: build merge data → docxtemplater fill → LibreOffice → PDF.
4. Merge PDFs → one packet → detect anchors → place signer boxes.
5. Create one `Envelope` (status SENT), snapshot boxes → existing Resend email +
   `/sign/{token}` flow (reuse `src/app/api/esign/envelopes/send` + finish routes).

## Out of scope (v1)

- Company counter-signature. Editing merged output before send. Per-doc separate
  envelopes. Multiple legal networks beyond Citadel/Victory.

## Testable slice order

1. docx merge lib + token catalog + scalar/table fill (preview one template).
2. Template categories + `.docx` upload.
3. Routing + packet assembly (merged PDF preview).
4. Anchor → signature box detection.
5. Wire to existing envelope send.
