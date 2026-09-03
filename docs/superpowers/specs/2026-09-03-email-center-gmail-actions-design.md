# Email Center — Gmail Send / Reply / Forward / Attachments / Modify

Design spec. Date: 2026-09-03.

## Summary

Add Gmail-native outbound and mailbox actions to the Email Center for 1:1
conversation. Reps send, reply, reply-all, and forward **through their own real
Gmail** (via the Gmail API using the domain-wide-delegation service account),
with file **attachments**. CRM inbox actions (**mark read / archive / label**)
reflect back into the rep's real Gmail. Bulk Campaigns and Flows are unchanged
and keep sending via Resend.

This extends the existing read-only Gmail Mailbox Sync (see
`2026-08-31-gmail-mailbox-sync-design.md`) into a read/write integration.

## Decisions (locked with Bar)

1. **Send path:** 1:1 compose/reply/reply-all/forward go through the rep's real
   Gmail (lands in their Gmail Sent, real Gmail threading). Bulk
   Campaigns/Flows **stay on Resend** (Gmail's ~2,000/day limit + no native
   unsubscribe make it wrong for marketing volume).
2. **Features this project:** send-with-attachments, reply/reply-all, forward
   (with original attachments), mark-read/archive/label reflected to Gmail.
3. **Scope:** use `https://mail.google.com/` for write operations (already
   authorized on the CRM service account's domain-wide delegation; it is the
   superset covering read+send+modify). The automated read sync stays on
   `gmail.readonly` (least privilege for the unattended cron).
4. **Attachment storage:** outgoing files persist on the `/data` volume
   (reuse the `EmailTemplateAttachment` / `attachments-storage.ts` pattern);
   incoming attachments are NOT bulk-downloaded — metadata is captured during
   sync and the bytes are fetched from Gmail on demand.

## Non-goals

- No bulk sending via Gmail (campaigns/flows stay Resend).
- No permanent delete of Gmail messages (archive only; no `mail.google.com`
  trash-bypass deletes from the CRM in this project).
- No contacts/calendar/Drive sync (separate future work).
- No rich HTML WYSIWYG editor beyond what compose has today.

## Architecture

### Data model (Prisma)

- **New `EmailAttachment`** (per-message attachments):
  - `id`, `messageId` (FK `EmailMessage`, `onDelete: Cascade`), `filename`,
    `contentType`, `byteSize`.
  - `storagePath String?` — set for OUTBOUND files saved under
    `/data/email-attachments`.
  - `gmailAttachmentId String?` — set for INBOUND attachments, used to fetch
    bytes from Gmail on demand (`users.messages.attachments.get`).
  - `@@index([messageId])`.
  - Exactly one of `storagePath` / `gmailAttachmentId` is set.
- **`EmailMessage.gmailThreadId String?`** — the Gmail thread id. Captured
  during sync and passed to `messages.send` so replies land in the exact same
  Gmail conversation. `@@index` not required (looked up via message row).
- **`EmailMessage.archivedAt DateTime?`** — CRM mirror of "removed from Gmail
  INBOX" via the archive action.

### Libraries

- **`src/lib/google/mime-build.ts`** (pure, TDD): builds a raw RFC-2822 message.
  - Inputs: from, to[], cc[], bcc[], subject, bodyText?, bodyHtml?,
    inReplyTo?, references?, messageId, attachments (filename, contentType,
    Buffer).
  - Output: base64url-encoded raw string ready for `messages.send`.
  - `multipart/mixed` when attachments present; `multipart/alternative` for
    text+html; simple part otherwise. Proper header folding + encoding.
- **`src/lib/google/gmail-send.ts`**: orchestration (mockable deps like
  `gmail-sync.ts`).
  - Build MIME -> `client.sendRaw(raw, gmailThreadId?)` -> persist an
    `EmailMessage` (provider `GMAIL`, direction OUTBOUND, status SENT,
    ownerId = rep, `gmailMessageId` + `gmailThreadId` from response, our
    generated `messageIdHeader` so the later synced copy collapses,
    `subjectNorm`, threaded via existing resolver / self-anchor, record links
    carried from the source message on reply/forward) + `EmailAttachment` rows.
- **Extend `src/lib/google/gmail-client.ts`** on a `mail.google.com`-scoped JWT:
  - `sendRaw(rawBase64url, threadId?)` -> `{ id, threadId }`.
  - `modifyLabels(messageId, { add, remove })`.
  - `getAttachment(messageId, attachmentId)` -> Buffer.
  - Read sync's `makeGmailClient` keeps `gmail.readonly`. A separate
    `makeGmailWriteClient(repEmail)` mints the `mail.google.com` token.

### Routes (all `Email.Send`-gated; owner/self-scoped)

- `POST /api/emails/attachments` (multipart) -> save to `/data`, return
  `{ id, filename, byteSize }`. Compose uploads here first (chips + remove).
- `POST /api/emails/gmail/send` -> new / reply / reply-all / forward.
  - Body: `to[]`, `cc[]`, `bcc[]`, `subject`, `bodyText`/`bodyHtml`,
    `attachmentIds[]`, optional `replyToMessageId` (our `EmailMessage.id`) and
    `forwardMessageId`.
  - Reply: pulls source `messageIdHeader` + `gmailThreadId` to chain
    (In-Reply-To/References + Gmail threadId); subject gets `Re:` if absent.
  - Forward: fetches the source message's original attachments from Gmail and
    re-attaches; subject gets `Fwd:`.
- `GET /api/emails/[id]/attachments/[attId]` -> stream bytes. Outgoing from
  `/data`; incoming fetched live via `getAttachment`. Access gated by the
  caller's visibility of the parent message.
- `POST /api/emails/[id]/actions` -> `{ action: "markRead" | "archive" |
  "label", label? }`. Calls Gmail `modifyLabels` (markRead: remove `UNREAD`;
  archive: remove `INBOX` + set `archivedAt`; label: resolve/create the Gmail
  label id then add) and updates CRM state (`readAt`, `archivedAt`).

### Sync change

`gmail-sync.ts` additionally captures, per stored message:
- `gmailThreadId` (from the message resource),
- attachment metadata rows (`EmailAttachment` with `gmailAttachmentId`) for each
  attachment part (filename/contentType/size), without downloading bytes.
Backward compatible: existing rows just lack these until re-synced.

### UI (monochrome `ec-` design system)

- **Compose**: file-picker + attachment chips (name, size, remove); sends via
  `/api/emails/gmail/send`.
- **Thread view**: `Reply` / `Reply-all` / `Forward` buttons; each message shows
  an attachment list with download links; `mark read` / `archive` / `label`
  controls on the thread/message.

## Testing

- **Unit (TDD)**: `mime-build.ts` — headers present + correct, multipart
  structure with attachments, base64url round-trip, reply headers
  (In-Reply-To/References), subject Re:/Fwd: normalization.
- **Unit (mocked client)**: `gmail-send.ts` persists the right `EmailMessage` +
  `EmailAttachment` rows; reply carries record links + threading; forward
  re-attaches originals. Same injected-deps pattern as `gmail-sync.test.ts`.
- **Integration**: routes' auth/role gating; attachment upload/stream.
- **Browser E2E**: compose-with-attachment send, reply chains in thread,
  forward with original file, archive removes from inbox view.

## Delivery phases (one spec, two implementation plans)

1. **Core send**: MIME builder + write client + `gmail-send` + attachment
   upload/store + `POST /api/emails/gmail/send` + compose attachments + reply /
   reply-all / forward + attachment download. Schema: `EmailAttachment`,
   `gmailThreadId`.
2. **Mailbox actions + incoming attachments**: `POST /api/emails/[id]/actions`
   (mark-read/archive/label to Gmail), sync capture of incoming attachment
   metadata + `gmailThreadId`, incoming attachment on-demand streaming, UI
   controls. Schema: `archivedAt`.

## Rollout / config

- No new env beyond the existing `GOOGLE_SA_CLIENT_EMAIL` /
  `GOOGLE_SA_PRIVATE_KEY` (write client uses the same key with the
  `mail.google.com` scope already authorized on the DWD client).
- Prisma schema changes apply on deploy via the existing boot `prisma db push`.
- Inert for any rep whose mailbox sync is not enabled / when `GOOGLE_SA_*`
  is unset (send route returns a clear "not configured").

## Risks / notes

- Gmail per-user send quota (~2,000/day) is ample for 1:1 but the send route
  should surface Gmail 4xx/quota errors to the composer rather than failing
  silently.
- HTML body sanitization: outgoing composer content should be sanitized before
  building MIME (carry the existing pattern; do not widen the pre-existing
  unsanitized-render issue).
- Forward re-attach fetches original bytes at send time (one extra Gmail call
  per attachment) — acceptable for 1:1.
