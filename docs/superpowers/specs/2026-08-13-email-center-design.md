# Email Center Design

Date: 2026-08-13
Status: Approved by Bar (design conversation, 2026-08-13)

## Goal

A Klaviyo-style Email Center inside Coastal CRM: one hub for email flows (automations), campaigns (blasts), reports, domain health, and a per-user inbox where each agent sees and sends their own mail while admins see everything. Every send is tracked (delivery, opens, clicks) and visible per lead. SMS flows and campaigns are Phase 2.

## Decisions (locked)

1. **User email identity**: per-user CRM addresses (e.g. `bar@coastaldebt.com`) sent via Resend. No external mailbox OAuth.
2. **SMS**: skipped in Phase 1. Data model and UI leave room for it (Twilio, existing account) in Phase 2.
3. **Domain health**: all three of DNS auth checks (SPF/DKIM/DMARC), reputation metrics from our own send data, and blacklist monitoring.
4. **Admin scope**: reuse the existing legacy admin role gate (same check as /settings/feedback). Admins see all inboxes and all reports; everyone else sees only their own.
5. **Flow builder**: extend the existing Flow builder (node canvas + executor), do not build a second one.
6. **Campaign audiences**: all three of filter-based Segments, existing ListViews, and SF Campaign members.
7. **Send domain**: everything from `coastaldebt.com`. The from-address is configurable per campaign so bulk can move to a subdomain later without code changes.

## What already exists (reused, not rebuilt)

- `EmailMessage`: direction, status lifecycle (DRAFT through CLICKED/BOUNCED), Lead/Contact/Account links, `openedAt`/`clickedAt`, provider id. Sent via Resend (`src/lib/email-sender.ts`), inbound webhook at `/api/emails/webhook/inbound`, Resend event webhook, tracking route `/api/emails/track/[trackingId]`, click rewrite (`src/lib/email/tracking-rewrite.ts`).
- `EmailTemplate` + attachments + merge fields (`src/lib/email/merge-fields.ts`).
- `MassEmail` + mass sender (`src/lib/email/mass-sender.ts`).
- `Flow`/`FlowRun`: node canvas (start/decision/action/wait/end) with executor (`src/lib/flow/executor.ts`, `nodes.ts`, `condition.ts`).
- `EngagementSequence`/`Step`/`Enrollment`, `CallCadence` (untouched by this project).
- `Campaign`/`CampaignContact` (SF-style membership, used as an audience source).
- `SuppressionEntry` (used for unsubscribes and suppression).
- `SmsMessage` model and Twilio telephony (Phase 2 foundation).

## Architecture

New `/email-center` app area with its own left nav (Console-style chrome). Tabs: **Inbox, Campaigns, Flows, Segments, Templates, Reports, Domain Health**. The hub wraps existing APIs and adds new ones under `/api/email-center/*` where no existing route fits.

### 1. Inbox (per-user)

- `User.mailboxAddress` (unique, nullable). Admins provision it in settings.
- **Outbound**: compose/reply/forward from the inbox sends through the existing queue + Resend sender, from the user's `mailboxAddress`. Template picker + merge fields available in compose. 1:1 sends get the same tracking as campaigns.
- **Inbound**: domain MX routes to the existing inbound webhook. The webhook matches the `to` address to a User via `mailboxAddress`, stores an INBOUND `EmailMessage` with `ownerId` = that user, and auto-links Lead/Contact/Account by sender email match.
- **Threading**: `EmailMessage.threadId` populated from References/In-Reply-To headers with normalized-subject + participants fallback. Inbox lists threads (conversation view), newest activity first, with unread state.
- **Admin view**: user switcher + "All users" showing every inbox, read-only unless composing as self.

### 2. Campaigns (blasts)

- Extend `MassEmail` into the campaign object: name, from-address (default the sender's mailbox or a company address, editable per campaign), audience definition, template ref or inline HTML, schedule (now or datetime), throttle (messages/minute), status (DRAFT, SCHEDULED, SENDING, SENT, FAILED, CANCELED).
- **Audience definition**: JSON `{ sources: [{type: "segment"|"listview"|"campaign", id}] }`. Resolved at send time, deduped by email address, then filtered against `SuppressionEntry` and hard-bounce history.
- **Unsubscribe**: tracked unsubscribe link in every campaign email plus `List-Unsubscribe` (mailto + one-click URL) headers. Both write to `SuppressionEntry`.
- Per-campaign report page (see Reports).

### 3. Segments

- New `Segment` model: name, entity (LEAD or CONTACT), filter JSON (field/operator/value groups with AND/OR), createdBy, timestamps.
- Filters cover: stage/status, lead source, state, owner, created date, last activity date, has-email, custom sfDataJson fields where already surfaced by list views.
- Evaluated dynamically at send/enroll time via Prisma queries using the report builder's json-filter pushdown pattern. Builder UI shows a live member-count preview.

### 4. Flows (automations)

Extending the existing builder and executor:
- **Triggers** (new trigger config on Flow): lead created, lead stage changed (with from/to filters), contact created, tag/segment entry, inactivity (no email/call/task in N days). Trigger evaluation runs on record events plus a periodic sweep for inactivity/segment entry.
- **New action nodes**: send email (template, from: record owner's mailbox or fixed address), enroll in flow, unenroll, add to campaign. Existing wait and decision nodes give delays and branching.
- **Attribution**: `EmailMessage.flowId`/`flowRunId` (nullable) so reports can group by flow.
- **Safety**: per-flow re-entry rule (once ever, or re-enroll after N days), global suppression respected on every send node.

### 5. Reports

- **Overview dashboard**: sends, delivery rate, unique open rate, unique CTR, bounce rate, unsubscribe count; trend charts; filters for date range, user, campaign, flow. Agents see their own numbers, admins see all with per-user breakdown.
- **Campaign/flow drill-down**: funnel (sent, delivered, opened, clicked), top clicked URLs, recipient list with per-recipient status.
- **Per-lead activity**: Email Activity panel on Lead/Account/Contact record pages listing every message with open/click status and source (inbox, campaign name, flow name).
- New `EmailEvent` model: messageId, type (DELIVERED, OPEN, CLICK, BOUNCE, COMPLAINT, UNSUBSCRIBE), occurredAt, url, userAgent, ip. Populated by the tracking routes and the Resend webhook. Unique opens/clicks computed from events; `EmailMessage.openedAt`/`clickedAt` remain as first-touch fast-path fields.

### 6. Domain Health

- **DNS auth**: live SPF, DKIM (Resend selector), and DMARC lookups for the sending domain; pass/fail per record with the exact DNS records to paste when failing.
- **Reputation**: computed from our own data per domain: bounce %, complaint %, open-rate trend over 30 days, rolled into a 0-100 health score with plain-language grading.
- **Blacklists**: DNSBL lookups (Spamhaus ZEN, Barracuda, SpamCop, SORBS) for the domain and Resend sending IPs.
- New `DomainHealthSnapshot` model storing each check run; daily cron refresh plus a manual "Re-check now" button. Trend chart from snapshots.

## Data model changes (all additive)

- New models: `Segment`, `EmailEvent`, `DomainHealthSnapshot`.
- `User`: add `mailboxAddress String? @unique`.
- `EmailMessage`: add `ownerId`, `threadId`, `flowId`, `flowRunId`, `massEmailId` (nullable, indexed).
- `MassEmail`: add audience JSON, schedule fields, throttle, from-address, extended status values.
- `Flow`: add trigger config JSON; new node type configs live in the existing nodes JSON.

## Error handling

- Send failures: existing queue retry semantics; FAILED messages surface in campaign drill-down and inbox outbox with the provider error.
- Inbound webhook: unmatched `to` address falls back to a catch-all admin inbox rather than dropping mail.
- Audience resolution: a campaign with an empty resolved audience blocks send with a clear message instead of silently sending to nobody.
- DNS/blacklist checks: network failures record an UNKNOWN status, never a false pass/fail.
- Flow sends: a failed send node logs on the FlowRun and continues or halts per a per-node setting (default halt).

## Testing

- Unit: threading resolution (headers + fallback), audience resolution and dedupe, segment filter to Prisma query translation, unsubscribe writes, health-score computation, trigger matching.
- Integration: inbound webhook to inbox routing, compose to queue to sender, campaign lifecycle (draft to sent) against a test audience, tracking pixel/click to EmailEvent.
- Manual gate before deploy: send a real campaign to a small internal segment, verify opens/clicks/unsubscribe land, verify inbox reply threading round-trips.

## Phasing

- **Phase 1a**: Email Center shell + Inbox (addresses, threading, compose, admin view).
- **Phase 1b**: Campaigns + Segments + unsubscribe compliance.
- **Phase 1c**: Flow triggers and email nodes + Reports + Domain Health.
- **Phase 2** (separate spec): SMS campaigns and flow nodes via Twilio, A2P compliance.

## Out of scope

- SMS (Phase 2), external mailbox OAuth (Gmail/Outlook), drag-drop visual email designer (templates are HTML + merge fields for now), send-time optimization, multi-domain sending.

## Open risks

- Root-domain sending: a bad blast can hurt deliverability for all company mail on coastaldebt.com. Mitigation: per-campaign from-address is configurable, so bulk can move to a subdomain by config alone.
- Inbound MX cutover for per-user addresses touches company mail routing. The inbound webhook must be verified against Resend's inbound format before any MX change, and the catch-all fallback protects against misrouted mail.
