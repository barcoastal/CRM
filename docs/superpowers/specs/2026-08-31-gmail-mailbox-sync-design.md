# Gmail Mailbox Sync Design

Date: 2026-08-31
Status: Approved by Bar (design conversation, 2026-08-31)

## Goal

Salesforce-style (Einstein Activity Capture) email capture for the Email Center: reps keep their `@coastaldebt.com` Google Workspace mailbox, and the CRM reads their sent + received mail via a service account (domain-wide delegation), keeps only messages tied to a known Lead/Contact/Account, and writes them into the existing `EmailMessage` inbox. Read-only. No DNS/MX changes. Runs on the existing mini cron.

## Decisions (locked)

1. **Domain-wide delegation (DWD):** one Google service account, authorized once by the Workspace super-admin, reads all reps' mailboxes. No per-rep OAuth clicking.
2. **CRM-match-only storage:** a message is stored only when the counterparty's email matches a Lead, Contact, or Account. Personal/internal mail is skipped.
3. **Read-only** (`gmail.readonly`). Sending is unchanged (campaigns/flows/1:1 still go via Resend); this only captures what reps do in Gmail plus incoming replies.
4. **Poll via cron** using Gmail's History API (incremental cursor), not push/Pub-Sub, for v1.
5. **Opt-in per rep** via an admin toggle (default off) with a bulk "enable all" action.

## Google-side prerequisites (BLOCKING - Bar/Workspace admin must do)

1. Google Cloud project with the **Gmail API** enabled.
2. A **service account** + JSON key; enable **domain-wide delegation**; note its numeric **Client ID**.
3. Workspace **Admin console → Security → API Controls → Domain-wide delegation**: authorize that Client ID for scope `https://www.googleapis.com/auth/gmail.readonly`.
4. Provide the service account **client email** + **private key** (from the JSON) -> set as Railway env `GOOGLE_SA_CLIENT_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`.

If Workspace super-admin access is unavailable, the fallback is per-rep OAuth (each rep connects once); that is a different spec and NOT covered here.

## Architecture

### Auth: service-account impersonation

`src/lib/google/gmail-auth.ts`: build a `google.auth.JWT` from `GOOGLE_SA_CLIENT_EMAIL` + `GOOGLE_SA_PRIVATE_KEY` with `subject = <rep email>` and scope `gmail.readonly`, returning an authorized Gmail client per rep. Tokens are minted on demand (no per-rep refresh tokens stored). Uses the `googleapis` npm package (added as a dependency).

### Data model

New `GmailSync` model (one per synced rep):
```
model GmailSync {
  id           String   @id @default(cuid())
  userId       String   @unique
  user         User     @relation(...)
  emailAddress String            // the rep's @coastaldebt.com address (impersonation subject)
  status       String   @default("ACTIVE") // ACTIVE | PAUSED | ERROR
  historyId    String?           // Gmail incremental cursor; null = needs initial backfill
  lastSyncedAt DateTime?
  lastError    String?
  syncedCount  Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([status])
}
```
`EmailMessage` gains a nullable `gmailMessageId String? @unique` (Gmail's message id) for dedup and to mark provenance; `provider = "GMAIL"` on synced rows.

### Sync engine

`src/lib/google/gmail-sync.ts` (orchestration) + pure helpers in `src/lib/google/gmail-map.ts` (testable):
- `POST /api/email-center/gmail/sync` (bearer auth: `FLOW_POLL_SECRET` / `PROCESSOR_SYNC_SECRET`, same contract as the other crons; added to the mini cron each run). Loops `GmailSync` rows with status ACTIVE, bounded batch.
- Per rep, in its own try/catch:
  - **First run (no historyId):** bounded backfill via `messages.list` with `q = "newer_than:30d"`, fetch each message, then store the mailbox's current `historyId`.
  - **Incremental:** `users.history.list(startHistoryId)` -> new/added message ids -> fetch each. On `404` (expired cursor) re-seed via the backfill path.
  - For each fetched message: parse `From`, `To`, `Subject`, `Date`, `Message-ID` header, and a text/plain (or stripped-HTML) body; determine **direction** (OUTBOUND if the rep's address is in `From`, else INBOUND); pick the **counterparty** (the `From` for INBOUND, the first `To` for OUTBOUND).
  - **Match** the counterparty email to a Lead/Contact/Account (reuse the inbound webhook's case-insensitive matching). If no match, **skip** (do not store).
  - If matched, **upsert** an `EmailMessage` keyed on `gmailMessageId` (skip if it exists): `provider "GMAIL"`, direction, ownerId = the rep, leadId/contactId/accountId, subject/subjectNorm, body, `messageIdHeader` (normalized), threaded via the existing `resolveThreadId`/self-anchor convention.
  - Advance `historyId`, bump `syncedCount`, set `lastSyncedAt`; on error set status ERROR + lastError.

### Dedup

Two layers: `gmailMessageId` unique (never re-store the same Gmail message), and the RFC `Message-ID` header (`messageIdHeader`). To collapse a CRM-originated send (via Resend) with its copy in the rep's Gmail Sent folder, the CRM's outbound send path will **start stamping `messageIdHeader`** with the RFC Message-ID (captured from Resend), and the Gmail sync skips a message whose `messageIdHeader` already exists. Absent that header on legacy sends, a rare duplicate is accepted.

### Admin UI

`src/app/(dashboard)/email-center/settings/gmail/page.tsx` (admin-only, ADMIN_ROLES): a Klaviyo-styled list of active `@coastaldebt.com` users showing sync status (on/off, last synced, last error, synced count), a per-row enable/disable toggle, a **bulk "Enable all reps"** action, and a **"Sync now"** button that triggers one immediate run. Reachable from the Email Center rail (an admin-only "Mailbox Sync" entry) and/or Settings.

## Data flow

1. Admin enables a rep -> `GmailSync` row created (status ACTIVE, historyId null).
2. Cron hits `/api/email-center/gmail/sync` -> for each ACTIVE rep, impersonate -> backfill (first) or incremental -> match-filter -> upsert `EmailMessage` (provider GMAIL) -> advance cursor.
3. Synced mail appears in that rep's Email Center inbox and on the matched record's Email Activity panel, threaded with everything else. Execution/sending paths are untouched.

## Error handling

- Per-mailbox try/catch: one rep's failure (revoked scope, quota, bad token) sets that `GmailSync` to ERROR + lastError and never blocks other reps or the cron response.
- Expired `historyId` (Gmail 404) triggers a clean re-seed rather than a hard failure.
- Missing env (`GOOGLE_SA_*`) -> the sync endpoint returns a clear "not configured" and does nothing (no crash).
- All Gmail writes to `EmailMessage` are best-effort per message; a single malformed message is logged and skipped.
- Backfill and per-run fetches are bounded (30-day initial window, capped batch per run) to avoid ingesting years of mail or blowing quota.

## Testing

- Unit (vitest, pure, `src/lib/google/gmail-map.ts`): header parsing (From/To/Subject/Message-ID), direction detection (rep is sender), counterparty selection, Gmail-message -> EmailMessage field mapping, dedup key.
- Integration: sync orchestration with a **mocked Gmail client** returning fake messages -> assert matched messages create `EmailMessage` rows, unmatched are skipped, existing `gmailMessageId`/`messageIdHeader` dedup, cursor advances, one bad message doesn't abort the batch.
- Manual (once creds are set): enable one rep, run a sync, confirm their real CRM-matching mail lands in the inbox and on the record, and that personal/unmatched mail does not.

## Out of scope

- Sending through Gmail (sending stays on Resend).
- Push/Pub-Sub real-time sync (poll only in v1).
- Attachments ingestion (metadata + body only in v1).
- Per-rep OAuth (only relevant if DWD is not possible; separate spec).
- Calendar/other Google data.

## Open risks

- **Volume/quota:** 135 mailboxes on a frequent cron. Mitigated by the 30-day initial window, capped per-run batch, cheap incremental History API calls, and match-filtering before any DB write. Sync interval tunable (start every 5 min).
- **CRM-originated send duplication** until `messageIdHeader` is stamped on all outbound paths (campaigns/flows/compose). The plan stamps it on the main compose/send path first; bulk paths follow.
- **Privacy:** match-filtering keeps personal mail out, but a rep emailing a personal contact who happens to be a CRM lead would be captured. Acceptable and consistent with Einstein Activity Capture behavior; the admin opt-in per rep is the control.
- **Prod secret handling:** the service-account private key is sensitive; it lives only in Railway env, never in the repo.
