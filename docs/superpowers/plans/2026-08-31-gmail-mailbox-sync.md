# Gmail Mailbox Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture reps' `@coastaldebt.com` Gmail (sent + received) into the existing `EmailMessage` inbox via a service account (domain-wide delegation), keeping only mail tied to a Lead/Contact/Account. Read-only, cron-driven, no DNS.

**Architecture:** A pure `gmail-map` lib (header parse, direction, counterparty, message->EmailMessage mapping, dedup) is TDD'd. The sync engine takes an INJECTED Gmail client interface so it is unit-testable with a mock; the real client wraps `googleapis` with service-account JWT impersonation. A bearer-authed cron endpoint loops opt-in mailboxes, does an incremental History-API pull (bounded backfill on first run), match-filters, and upserts `EmailMessage` rows (`provider "GMAIL"`, deduped by a unique `gmailMessageId`). An admin UI toggles which reps are synced.

**Tech Stack:** Next.js App Router, Prisma/Postgres (`prisma db push`, no migrations dir), `googleapis`, vitest. Monochrome `.ec-` design system.

**Spec:** `docs/superpowers/specs/2026-08-31-gmail-mailbox-sync-design.md`.

**Codebase facts the engineer needs:**
- `EmailMessage` (prisma/schema.prisma) fields relevant here: direction (INBOUND|OUTBOUND), status, fromAddress, toAddresses (CSV), cc, subject, subjectNorm, bodyHtml, bodyText, provider (string; existing values RESEND / RESEND_INBOUND / GMAIL new), providerMessageId, messageIdHeader (RFC id WITHOUT angle brackets), inReplyTo, threadId, leadId/contactId/accountId/opportunityId, ownerId, createdAt/sentAt. Threading is self-anchored (threadId = own id for new threads).
- Threading lib `src/lib/email/threading.ts` exports: `normalizeSubject(s)`, `normalizeMessageId(id)` (strips angle brackets, lowercases), `extractEmails(raw)` (returns lowercase bare addresses), `resolveThreadId(candidate, finders)`, `prismaThreadFinders()`.
- Inbound webhook matching pattern to REUSE (`src/app/api/emails/webhook/inbound/route.ts`): match a bare email against Lead.email / Contact.email / Account.email / Opportunity.oppEmail case-insensitively:
  ```ts
  const [lead, contact, account] = await Promise.all([
    prisma.lead.findFirst({ where: { email: { equals: e, mode: "insensitive" } }, select: { id: true, assignedToId: true } }),
    prisma.contact.findFirst({ where: { email: { equals: e, mode: "insensitive" } }, select: { id: true, ownerId: true } }),
    prisma.account.findFirst({ where: { email: { equals: e, mode: "insensitive" } }, select: { id: true, ownerId: true } }),
  ]);
  ```
- Cron auth to COPY verbatim (`src/app/api/flow/sweep/route.ts` `authorize(req)`): Bearer `FLOW_POLL_SECRET`, fallback `PROCESSOR_SYNC_SECRET`. The mini cron `~/crm-cron/run.sh` calls the email/flow crons each minute; add the gmail sync there.
- The Resend sender (`src/lib/email-sender.ts` `sendQueuedEmail`) returns Resend's `id` as `providerMessageId` (a UUID, NOT the RFC Message-ID). `sendViaResend` supports a `headers` arg (used for In-Reply-To/List-Unsubscribe).
- ADMIN_ROLES = `["SUPER_ADMIN", "ADMIN", "MANAGER"]`. Auth in API routes: `requireAuthOrRespond("Email.Send")` -> `r.session.userId` / `r.session.role`. Server pages: `auth()` + `redirect("/login")`.
- Email Center rail: `src/app/(dashboard)/email-center/tab-rail.tsx` (Messaging + SMS sections). `.ec-` classes in `src/app/(dashboard)/email-center/email-center.css`.
- Tests: vitest, `tests/*.test.ts`, `@` -> `./src`. Local DB `postgresql://postgres:postgres@localhost:5432/crm_local` (repo .env is stale sqlite; ALWAYS override DATABASE_URL). No em dashes. Never push to remote. Work on current `main` (parallel work has landed: SMS tabs, closer tiers).

**File structure:**
- `src/lib/google/gmail-map.ts` - pure parse/map/dedup helpers (TDD).
- `src/lib/google/gmail-client.ts` - the injected `GmailClient` interface + the real googleapis-backed impl with SA impersonation.
- `src/lib/google/gmail-sync.ts` - orchestration (loop mailboxes, backfill/incremental, match, upsert). Takes a client factory + prisma.
- `src/app/api/email-center/gmail/sync/route.ts` - bearer cron endpoint.
- `src/app/api/email-center/gmail/mailboxes/route.ts` + `/[userId]/route.ts` - admin enable/disable/bulk/sync-now.
- `src/app/(dashboard)/email-center/settings/gmail/` - admin UI (page + client).
- Schema: `GmailSync` model, `EmailMessage.gmailMessageId`.
- Modify `src/lib/email-sender.ts` - stamp a Message-ID header for dedup.

---

### Task 1: Deps + schema

**Files:**
- Modify: `package.json` (add googleapis)
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the googleapis dependency**

Run: `npm install googleapis` (latest)
Expected: added to package.json dependencies, lockfile updated. googleapis bundles google-auth-library (used for the service-account JWT).

- [ ] **Step 2: Add `gmailMessageId` to EmailMessage**

In `model EmailMessage`, after the `messageIdHeader` line (or near the provider fields), add:
```prisma
  // Gmail message id for mailbox-synced rows (provider = "GMAIL"); unique for dedup.
  gmailMessageId String? @unique
```

- [ ] **Step 3: Add the GmailSync model + User relation**

Add near the other Email Center models:
```prisma
// Per-rep Gmail mailbox sync state (domain-wide delegation). One row = one
// opted-in rep. historyId is Gmail's incremental cursor; null = needs backfill.
model GmailSync {
  id           String    @id @default(cuid())
  userId       String    @unique
  user         User      @relation("GmailSyncUser", fields: [userId], references: [id])
  emailAddress String
  status       String    @default("ACTIVE") // ACTIVE | PAUSED | ERROR
  historyId    String?
  lastSyncedAt DateTime?
  lastError    String?
  syncedCount  Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([status])
}
```
On `model User`, add near its other relations: `gmailSync GmailSync? @relation("GmailSyncUser")`.

- [ ] **Step 4: Push + generate + validate**

Run: `npx prisma validate && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_local" npx prisma db push --accept-data-loss && npx prisma generate`
Expected: valid, in sync, client generated.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma
git commit -m "Gmail sync: googleapis dep, GmailSync model, EmailMessage.gmailMessageId"
```

---

### Task 2: Pure gmail-map lib (TDD)

**Files:**
- Create: `src/lib/google/gmail-map.ts`
- Test: `tests/gmail-map.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/gmail-map.test.ts
import { describe, it, expect } from "vitest";
import { parseHeaders, detectDirection, pickCounterparty, decodeBase64Url, type GmailHeaders } from "@/lib/google/gmail-map";

const rawHeaders = [
  { name: "From", value: "Client X <client@brightpath.com>" },
  { name: "To", value: "Rep One <rep@coastaldebt.com>" },
  { name: "Subject", value: "Re: your offer" },
  { name: "Message-ID", value: "<abc123@mail.brightpath.com>" },
  { name: "In-Reply-To", value: "<prev@coastaldebt.com>" },
  { name: "Date", value: "Wed, 20 Aug 2026 10:00:00 -0400" },
];

describe("parseHeaders", () => {
  it("extracts headers case-insensitively", () => {
    const h = parseHeaders(rawHeaders);
    expect(h.from).toBe("Client X <client@brightpath.com>");
    expect(h.to).toBe("Rep One <rep@coastaldebt.com>");
    expect(h.subject).toBe("Re: your offer");
    expect(h.messageId).toBe("<abc123@mail.brightpath.com>");
    expect(h.inReplyTo).toBe("<prev@coastaldebt.com>");
    expect(h.date).toBe("Wed, 20 Aug 2026 10:00:00 -0400");
  });
  it("returns empty strings for missing headers", () => {
    const h = parseHeaders([]);
    expect(h.from).toBe("");
    expect(h.subject).toBe("");
    expect(h.messageId).toBe("");
  });
});

describe("detectDirection", () => {
  it("OUTBOUND when the rep is the sender", () => {
    expect(detectDirection("rep@coastaldebt.com", "Rep One <rep@coastaldebt.com>")).toBe("OUTBOUND");
  });
  it("INBOUND when the rep is not the sender", () => {
    expect(detectDirection("rep@coastaldebt.com", "Client X <client@brightpath.com>")).toBe("INBOUND");
  });
  it("is case-insensitive on the rep address", () => {
    expect(detectDirection("Rep@Coastaldebt.com", "<rep@coastaldebt.com>")).toBe("OUTBOUND");
  });
});

describe("pickCounterparty", () => {
  it("uses From for inbound and To for outbound", () => {
    expect(pickCounterparty("INBOUND", rawHeaders[0].value, rawHeaders[1].value)).toBe("client@brightpath.com");
    expect(pickCounterparty("OUTBOUND", rawHeaders[0].value, rawHeaders[1].value)).toBe("rep@coastaldebt.com");
  });
  it("returns null when the relevant header has no address", () => {
    expect(pickCounterparty("INBOUND", "no address here", "x@y.com")).toBeNull();
  });
});

describe("decodeBase64Url", () => {
  it("decodes Gmail base64url payloads", () => {
    // "Hello" in base64url
    expect(decodeBase64Url("SGVsbG8")).toBe("Hello");
    expect(decodeBase64Url("")).toBe("");
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/gmail-map.test.ts` -> FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
// src/lib/google/gmail-map.ts
/**
 * Pure helpers for mapping Gmail API messages into EmailMessage rows.
 * No googleapis, no DB - unit-testable. The sync engine composes these.
 */
import { extractEmails } from "@/lib/email/threading";

export interface GmailHeaders {
  from: string;
  to: string;
  cc: string;
  subject: string;
  messageId: string;
  inReplyTo: string;
  date: string;
}

/** Gmail returns payload.headers as [{name,value}]; pull by case-insensitive name. */
export function parseHeaders(headers: Array<{ name?: string | null; value?: string | null }>): GmailHeaders {
  const get = (name: string) =>
    headers.find((h) => (h.name ?? "").toLowerCase() === name.toLowerCase())?.value ?? "";
  return {
    from: get("From"),
    to: get("To"),
    cc: get("Cc"),
    subject: get("Subject"),
    messageId: get("Message-ID"),
    inReplyTo: get("In-Reply-To"),
    date: get("Date"),
  };
}

export type Direction = "INBOUND" | "OUTBOUND";

/** OUTBOUND when the synced rep is among the From addresses. */
export function detectDirection(repEmail: string, fromHeader: string): Direction {
  const rep = repEmail.trim().toLowerCase();
  return extractEmails(fromHeader).includes(rep) ? "OUTBOUND" : "INBOUND";
}

/** The other party: the sender for inbound mail, the first recipient for outbound. */
export function pickCounterparty(direction: Direction, fromHeader: string, toHeader: string): string | null {
  const list = direction === "INBOUND" ? extractEmails(fromHeader) : extractEmails(toHeader);
  return list[0] ?? null;
}

/** Gmail bodies are base64url; decode to a UTF-8 string. */
export function decodeBase64Url(data: string): string {
  if (!data) return "";
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf-8");
}

/** Walk a Gmail payload tree; prefer text/plain, else strip text/html. */
export function extractPlainBody(payload: unknown): string {
  type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
  const p = payload as Part | undefined;
  if (!p) return "";
  const walk = (part: Part, want: string): string | null => {
    if (part.mimeType === want && part.body?.data) return decodeBase64Url(part.body.data);
    for (const child of part.parts ?? []) {
      const found = walk(child, want);
      if (found) return found;
    }
    return null;
  };
  const plain = walk(p, "text/plain");
  if (plain) return plain;
  const html = walk(p, "text/html");
  if (html) return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (p.body?.data) return decodeBase64Url(p.body.data);
  return "";
}
```

- [ ] **Step 4: Run tests, PASS. Full `npx vitest run` green.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/gmail-map.ts tests/gmail-map.test.ts
git commit -m "Gmail sync: pure header/direction/counterparty/body mapping lib"
```

---

### Task 3: GmailClient interface + real impl

**Files:**
- Create: `src/lib/google/gmail-client.ts`

- [ ] **Step 1: Implement the interface + service-account client**

```typescript
// src/lib/google/gmail-client.ts
/**
 * Gmail access via a service account with domain-wide delegation. The CRM
 * impersonates each rep (JWT subject = rep email) to read their mailbox with
 * gmail.readonly. The GmailClient interface is what gmail-sync depends on, so
 * tests can pass a mock instead of hitting Google.
 */
import { google } from "googleapis";

export interface GmailMessage {
  id: string;
  headers: Array<{ name?: string | null; value?: string | null }>;
  payload: unknown; // for body extraction
}

export interface GmailClient {
  /** Recent messages (initial backfill), returns ids + the mailbox's current historyId. */
  listRecent(query: string, max: number): Promise<{ messageIds: string[]; historyId: string | null }>;
  /** Incremental: message ids added since startHistoryId. `expired` when the cursor is too old. */
  listHistory(startHistoryId: string): Promise<{ messageIds: string[]; historyId: string | null } | { expired: true }>;
  getMessage(id: string): Promise<GmailMessage>;
}

export function gmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SA_CLIENT_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY);
}

/** Build a read-only Gmail client impersonating one rep. */
export function makeGmailClient(repEmail: string): GmailClient {
  const jwt = new google.auth.JWT({
    email: process.env.GOOGLE_SA_CLIENT_EMAIL,
    key: (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    subject: repEmail,
  });
  const gmail = google.gmail({ version: "v1", auth: jwt });

  return {
    async listRecent(query, max) {
      const res = await gmail.users.messages.list({ userId: "me", q: query, maxResults: max });
      const messageIds = (res.data.messages ?? []).map((m) => m.id!).filter(Boolean);
      const profile = await gmail.users.getProfile({ userId: "me" });
      return { messageIds, historyId: profile.data.historyId ?? null };
    },
    async listHistory(startHistoryId) {
      try {
        const ids = new Set<string>();
        let pageToken: string | undefined;
        let latestHistoryId: string | null = startHistoryId;
        do {
          const res = await gmail.users.history.list({
            userId: "me", startHistoryId, historyTypes: ["messageAdded"], pageToken, maxResults: 500,
          });
          for (const h of res.data.history ?? []) {
            for (const m of h.messagesAdded ?? []) if (m.message?.id) ids.add(m.message.id);
          }
          latestHistoryId = res.data.historyId ?? latestHistoryId;
          pageToken = res.data.nextPageToken ?? undefined;
        } while (pageToken);
        return { messageIds: [...ids], historyId: latestHistoryId };
      } catch (e: unknown) {
        // 404 = startHistoryId too old; caller re-seeds.
        if ((e as { code?: number }).code === 404) return { expired: true };
        throw e;
      }
    },
    async getMessage(id) {
      const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      return { id, headers: res.data.payload?.headers ?? [], payload: res.data.payload };
    },
  };
}
```

- [ ] **Step 2: Verify typecheck + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "gmail-client" || echo CLEAN`
Note: googleapis types are large; if tsc is slow, the Task 8 build is the backstop.

```bash
git add src/lib/google/gmail-client.ts
git commit -m "Gmail sync: service-account GmailClient interface + impl"
```

---

### Task 4: Sync engine (injected client, TDD with a mock)

**Files:**
- Create: `src/lib/google/gmail-sync.ts`
- Test: `tests/gmail-sync.test.ts`

- [ ] **Step 1: Write the failing tests (mock client + mock prisma)**

```typescript
// tests/gmail-sync.test.ts
import { describe, it, expect, vi } from "vitest";
import { syncOneMailbox, type SyncDeps } from "@/lib/google/gmail-sync";
import type { GmailClient, GmailMessage } from "@/lib/google/gmail-client";

function msg(id: string, from: string, to: string, subject: string, messageId: string): GmailMessage {
  return {
    id,
    headers: [
      { name: "From", value: from },
      { name: "To", value: to },
      { name: "Subject", value: subject },
      { name: "Message-ID", value: messageId },
      { name: "Date", value: "Wed, 20 Aug 2026 10:00:00 -0400" },
    ],
    payload: { mimeType: "text/plain", body: { data: Buffer.from("hi").toString("base64url") } },
  };
}

function fakeClient(messages: GmailMessage[]): GmailClient {
  return {
    listRecent: async () => ({ messageIds: messages.map((m) => m.id), historyId: "1000" }),
    listHistory: async () => ({ messageIds: messages.map((m) => m.id), historyId: "1001" }),
    getMessage: async (id) => messages.find((m) => m.id === id)!,
  };
}

/** Build deps where matchByEmail returns a lead for a known address only. */
function makeDeps(created: Record<string, unknown>[], seenGmailIds = new Set<string>(), seenMsgHeaders = new Set<string>()): SyncDeps {
  return {
    matchByEmail: async (email: string) =>
      email === "client@brightpath.com" ? { leadId: "lead1", contactId: null, accountId: null, ownerId: "rep1" } : null,
    existsByGmailId: async (id: string) => seenGmailIds.has(id),
    existsByMessageIdHeader: async (h: string) => seenMsgHeaders.has(h),
    createMessage: async (data) => { created.push(data); },
    resolveThread: async () => null, // new thread -> self-anchor
  };
}

describe("syncOneMailbox", () => {
  it("stores only messages that match a CRM record", async () => {
    const created: Record<string, unknown>[] = [];
    const client = fakeClient([
      msg("g1", "Client X <client@brightpath.com>", "rep@coastaldebt.com", "Re: offer", "<a@x.com>"), // match
      msg("g2", "Random <nobody@gmail.com>", "rep@coastaldebt.com", "Lunch?", "<b@x.com>"), // no match -> skip
    ]);
    const res = await syncOneMailbox({ repEmail: "rep@coastaldebt.com", repUserId: "rep1", historyId: "999" }, client, makeDeps(created));
    expect(created).toHaveLength(1);
    expect(created[0].gmailMessageId).toBe("g1");
    expect(created[0].provider).toBe("GMAIL");
    expect(created[0].leadId).toBe("lead1");
    expect(res.stored).toBe(1);
    expect(res.newHistoryId).toBe("1001");
  });
  it("sets direction OUTBOUND when the rep sent it", async () => {
    const created: Record<string, unknown>[] = [];
    const client = fakeClient([msg("g3", "rep@coastaldebt.com", "Client X <client@brightpath.com>", "Following up", "<c@x.com>")]);
    await syncOneMailbox({ repEmail: "rep@coastaldebt.com", repUserId: "rep1", historyId: "999" }, client, makeDeps(created));
    expect(created[0].direction).toBe("OUTBOUND");
    expect(created[0].leadId).toBe("lead1"); // matched on the To counterparty
  });
  it("dedups by gmailMessageId and by messageIdHeader", async () => {
    const created: Record<string, unknown>[] = [];
    const client = fakeClient([msg("g1", "Client X <client@brightpath.com>", "rep@coastaldebt.com", "Re: offer", "<a@x.com>")]);
    const deps = makeDeps(created, new Set(["g1"]));
    const res = await syncOneMailbox({ repEmail: "rep@coastaldebt.com", repUserId: "rep1", historyId: "999" }, client, deps);
    expect(created).toHaveLength(0);
    expect(res.stored).toBe(0);
  });
  it("does an initial backfill when historyId is null", async () => {
    const created: Record<string, unknown>[] = [];
    const client = fakeClient([msg("g1", "Client X <client@brightpath.com>", "rep@coastaldebt.com", "Hi", "<a@x.com>")]);
    const listRecent = vi.fn(client.listRecent);
    const res = await syncOneMailbox({ repEmail: "rep@coastaldebt.com", repUserId: "rep1", historyId: null }, { ...client, listRecent }, makeDeps(created));
    expect(listRecent).toHaveBeenCalled();
    expect(res.newHistoryId).toBe("1000");
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

Run: `npx vitest run tests/gmail-sync.test.ts`

- [ ] **Step 3: Implement the engine**

```typescript
// src/lib/google/gmail-sync.ts
/**
 * Gmail sync orchestration. Pure of DB/Google specifics: it takes an injected
 * GmailClient and a SyncDeps bag (match/exists/create/thread), so it is fully
 * unit-testable. The cron route wires the real prisma + client.
 */
import { parseHeaders, detectDirection, pickCounterparty, extractPlainBody } from "./gmail-map";
import { normalizeSubject, normalizeMessageId } from "@/lib/email/threading";
import type { GmailClient } from "./gmail-client";

export interface MatchResult { leadId: string | null; contactId: string | null; accountId: string | null; ownerId: string | null }

export interface SyncDeps {
  matchByEmail(email: string): Promise<MatchResult | null>;
  existsByGmailId(gmailId: string): Promise<boolean>;
  existsByMessageIdHeader(header: string): Promise<boolean>;
  createMessage(data: Record<string, unknown>): Promise<void>;
  resolveThread(counterparty: string, subject: string, inReplyTo: string | null): Promise<string | null>;
}

export interface MailboxRef { repEmail: string; repUserId: string; historyId: string | null }
export interface SyncResult { stored: number; scanned: number; newHistoryId: string | null; reseeded: boolean }

const BACKFILL_QUERY = "newer_than:30d";
const BACKFILL_MAX = 300;

export async function syncOneMailbox(mb: MailboxRef, client: GmailClient, deps: SyncDeps): Promise<SyncResult> {
  let messageIds: string[] = [];
  let newHistoryId: string | null = mb.historyId;
  let reseeded = false;

  if (!mb.historyId) {
    const r = await client.listRecent(BACKFILL_QUERY, BACKFILL_MAX);
    messageIds = r.messageIds;
    newHistoryId = r.historyId;
  } else {
    const r = await client.listHistory(mb.historyId);
    if ("expired" in r) {
      const seed = await client.listRecent(BACKFILL_QUERY, BACKFILL_MAX);
      messageIds = seed.messageIds;
      newHistoryId = seed.historyId;
      reseeded = true;
    } else {
      messageIds = r.messageIds;
      newHistoryId = r.historyId ?? mb.historyId;
    }
  }

  let stored = 0;
  for (const id of messageIds) {
    try {
      if (await deps.existsByGmailId(id)) continue;
      const m = await client.getMessage(id);
      const h = parseHeaders(m.headers);
      const direction = detectDirection(mb.repEmail, h.from);
      const counterparty = pickCounterparty(direction, h.from, h.to);
      if (!counterparty) continue;
      const match = await deps.matchByEmail(counterparty);
      if (!match) continue; // CRM-match-only

      const msgHeader = h.messageId ? normalizeMessageId(h.messageId) : null;
      if (msgHeader && (await deps.existsByMessageIdHeader(msgHeader))) continue; // collapse with CRM-sent copy

      const subject = h.subject || "(no subject)";
      const threadId = await deps.resolveThread(counterparty, subject, h.inReplyTo ? normalizeMessageId(h.inReplyTo) : null);

      await deps.createMessage({
        direction,
        status: direction === "OUTBOUND" ? "SENT" : "DELIVERED",
        provider: "GMAIL",
        gmailMessageId: id,
        fromAddress: h.from,
        toAddresses: h.to,
        cc: h.cc || null,
        subject,
        subjectNorm: normalizeSubject(subject),
        bodyText: extractPlainBody(m.payload) || null,
        messageIdHeader: msgHeader,
        inReplyTo: h.inReplyTo ? normalizeMessageId(h.inReplyTo) : null,
        leadId: match.leadId,
        contactId: match.contactId,
        accountId: match.accountId,
        ownerId: mb.repUserId,
        threadId, // null -> the caller self-anchors after create
      });
      stored += 1;
    } catch {
      // one bad message never aborts the mailbox
      continue;
    }
  }
  return { stored, scanned: messageIds.length, newHistoryId, reseeded };
}
```

- [ ] **Step 4: Run tests, PASS. Full `npx vitest run` green.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/gmail-sync.ts tests/gmail-sync.test.ts
git commit -m "Gmail sync: mailbox sync engine (match-filter, dedup, backfill) with tests"
```

---

### Task 5: Cron endpoint (wires real prisma + client + self-anchor)

**Files:**
- Create: `src/app/api/email-center/gmail/sync/route.ts`

- [ ] **Step 1: Implement the cron route**

```typescript
// src/app/api/email-center/gmail/sync/route.ts
/**
 * POST /api/email-center/gmail/sync
 * Authorization: Bearer ${FLOW_POLL_SECRET} (or PROCESSOR_SYNC_SECRET)
 *
 * Loops ACTIVE GmailSync rows, syncs each mailbox, upserts matched mail as
 * EmailMessage (provider GMAIL). Add to the mini cron. Optional body { userId }
 * syncs just one mailbox (used by the admin "Sync now" button via internal call).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gmailConfigured, makeGmailClient } from "@/lib/google/gmail-client";
import { syncOneMailbox, type SyncDeps } from "@/lib/google/gmail-sync";
import { resolveThreadId, prismaThreadFinders } from "@/lib/email/threading";

function authorize(req: NextRequest): boolean {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const primary = process.env.FLOW_POLL_SECRET;
  const fallback = process.env.PROCESSOR_SYNC_SECRET;
  if (!primary && !fallback) return false;
  return (!!primary && token === primary) || (!!fallback && token === fallback);
}

function makeDeps(): SyncDeps {
  return {
    async matchByEmail(email) {
      const [lead, contact, account] = await Promise.all([
        prisma.lead.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, assignedToId: true } }),
        prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, ownerId: true } }),
        prisma.account.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, ownerId: true } }),
      ]);
      if (!lead && !contact && !account) return null;
      return { leadId: lead?.id ?? null, contactId: contact?.id ?? null, accountId: account?.id ?? null, ownerId: null };
    },
    async existsByGmailId(id) {
      return Boolean(await prisma.emailMessage.findUnique({ where: { gmailMessageId: id }, select: { id: true } }));
    },
    async existsByMessageIdHeader(header) {
      return Boolean(await prisma.emailMessage.findFirst({ where: { messageIdHeader: header }, select: { id: true } }));
    },
    async createMessage(data) {
      const created = await prisma.emailMessage.create({ data: data as never, select: { id: true, threadId: true } });
      if (!created.threadId) {
        await prisma.emailMessage.update({ where: { id: created.id }, data: { threadId: created.id } });
      }
    },
    async resolveThread(counterparty, subject, inReplyTo) {
      return resolveThreadId({ inReplyTo, subject, counterpartyEmails: [counterparty] }, prismaThreadFinders());
    },
  };
}

async function runSync(where: { userId?: string }) {
  const rows = await prisma.gmailSync.findMany({
    where: { status: "ACTIVE", ...(where.userId ? { userId: where.userId } : {}) },
    take: 200,
  });
  const deps = makeDeps();
  const results: Array<{ userId: string; stored?: number; error?: string }> = [];
  for (const row of rows) {
    try {
      const client = makeGmailClient(row.emailAddress);
      const r = await syncOneMailbox({ repEmail: row.emailAddress, repUserId: row.userId, historyId: row.historyId }, client, deps);
      await prisma.gmailSync.update({
        where: { userId: row.userId },
        data: { historyId: r.newHistoryId, lastSyncedAt: new Date(), lastError: null, status: "ACTIVE", syncedCount: { increment: r.stored } },
      });
      results.push({ userId: row.userId, stored: r.stored });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "sync failed";
      await prisma.gmailSync.update({ where: { userId: row.userId }, data: { status: "ERROR", lastError: msg.slice(0, 500) } }).catch(() => undefined);
      results.push({ userId: row.userId, error: msg });
    }
  }
  return results;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!gmailConfigured()) return NextResponse.json({ ok: false, skipped: "GOOGLE_SA not configured" });
  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  const results = await runSync({ userId: body.userId });
  return NextResponse.json({ ok: true, mailboxes: results.length, results });
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "gmail/sync" || echo CLEAN`; `npx vitest run` green.
Functional (local, no creds): `curl -s -X POST localhost:PORT/api/email-center/gmail/sync -H "Authorization: Bearer wrong"` -> 401; with a real secret in the dev env -> `{ ok: false, skipped: "GOOGLE_SA not configured" }` (no crash). Kill server.

```bash
git add src/app/api/email-center/gmail/sync/route.ts
git commit -m "Gmail sync: bearer-authed cron endpoint wiring prisma + client"
```

---

### Task 6: Dedup - stamp Message-ID on CRM sends

**Files:**
- Modify: `src/lib/email-sender.ts`
- Test: `tests/gmail-dedup.test.ts`

- [ ] **Step 1: Write the failing test for the id generator**

```typescript
// tests/gmail-dedup.test.ts
import { describe, it, expect } from "vitest";
import { generateMessageId } from "@/lib/email-sender";
import { normalizeMessageId } from "@/lib/email/threading";

describe("generateMessageId", () => {
  it("produces an RFC-shaped id on the sending domain and round-trips through normalizeMessageId", () => {
    const id = generateMessageId("coastaldebt.com");
    expect(id).toMatch(/^<[a-z0-9.]+@coastaldebt\.com>$/i);
    const normalized = normalizeMessageId(id);
    expect(normalized).not.toContain("<");
    expect(normalized).toContain("@coastaldebt.com");
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

Run: `npx vitest run tests/gmail-dedup.test.ts`

- [ ] **Step 3: Implement + wire**

In `src/lib/email-sender.ts` add and export:
```typescript
import { randomBytes } from "node:crypto";

/** RFC 5322 Message-ID we control, so a Gmail-synced copy of a CRM send dedups. */
export function generateMessageId(domain: string): string {
  const rand = randomBytes(12).toString("hex");
  const stamp = Date.now().toString(36);
  return `<${stamp}.${rand}@${domain}>`;
}
```
In `sendQueuedEmail`, when building the message to send: derive the domain from the from-address (`fromAddress.match(/@([a-z0-9.-]+)/i)?.[1] ?? "coastaldebt.com"`), call `generateMessageId(domain)`, pass it to `sendViaResend` via the `headers` arg as `{ "Message-ID": id, ...existingHeaders }`, and persist `messageIdHeader: normalizeMessageId(id)` on the EmailMessage update alongside `providerMessageId`. Import `normalizeMessageId` from `@/lib/email/threading`. Do NOT overwrite an existing messageIdHeader if one is already set. Keep all existing send behavior intact.

Note: if Resend overrides the Message-ID at the infra level, dedup silently degrades to the gmailMessageId-only layer (rare duplicate). That is acceptable per the spec.

- [ ] **Step 4: Run tests, PASS. Full `npx vitest run` green. `npx tsc --noEmit 2>&1 | grep -i email-sender || echo CLEAN`.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-sender.ts tests/gmail-dedup.test.ts
git commit -m "Gmail sync: stamp our own Message-ID on CRM sends for dedup"
```

---

### Task 7: Admin UI (enable/disable/bulk/sync-now)

**Files:**
- Create: `src/app/api/email-center/gmail/mailboxes/route.ts` (GET list + POST bulk-enable)
- Create: `src/app/api/email-center/gmail/mailboxes/[userId]/route.ts` (PATCH enable/disable, POST sync-now)
- Create: `src/app/(dashboard)/email-center/settings/gmail/page.tsx` + `gmail-client.tsx`
- Modify: `src/app/(dashboard)/email-center/tab-rail.tsx` (admin-only "Mailbox Sync" entry)

- [ ] **Step 1: Mailboxes list + bulk-enable API**

```typescript
// src/app/api/email-center/gmail/mailboxes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const DOMAIN = "@coastaldebt.com";

export async function GET() {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const users = await prisma.user.findMany({
    where: { isActive: true, email: { endsWith: DOMAIN, mode: "insensitive" } },
    select: { id: true, name: true, email: true, gmailSync: { select: { status: true, lastSyncedAt: true, lastError: true, syncedCount: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items: users });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { bulkEnableAll?: boolean };
  if (!body.bulkEnableAll) return NextResponse.json({ error: "nothing to do" }, { status: 400 });
  const users = await prisma.user.findMany({
    where: { isActive: true, email: { endsWith: DOMAIN, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  let enabled = 0;
  for (const u of users) {
    if (!u.email) continue;
    await prisma.gmailSync.upsert({
      where: { userId: u.id },
      update: { status: "ACTIVE", emailAddress: u.email.toLowerCase() },
      create: { userId: u.id, emailAddress: u.email.toLowerCase(), status: "ACTIVE" },
    });
    enabled += 1;
  }
  return NextResponse.json({ ok: true, enabled });
}
```

- [ ] **Step 2: Per-user enable/disable + sync-now API**

```typescript
// src/app/api/email-center/gmail/mailboxes/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { gmailConfigured, makeGmailClient } from "@/lib/google/gmail-client";
import { syncOneMailbox, type SyncDeps } from "@/lib/google/gmail-sync";
import { resolveThreadId, prismaThreadFinders } from "@/lib/email/threading";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

function makeDeps(): SyncDeps {
  return {
    async matchByEmail(email) {
      const [lead, contact, account] = await Promise.all([
        prisma.lead.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
        prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
        prisma.account.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }),
      ]);
      if (!lead && !contact && !account) return null;
      return { leadId: lead?.id ?? null, contactId: contact?.id ?? null, accountId: account?.id ?? null, ownerId: null };
    },
    async existsByGmailId(id) { return Boolean(await prisma.emailMessage.findUnique({ where: { gmailMessageId: id }, select: { id: true } })); },
    async existsByMessageIdHeader(h) { return Boolean(await prisma.emailMessage.findFirst({ where: { messageIdHeader: h }, select: { id: true } })); },
    async createMessage(data) {
      const created = await prisma.emailMessage.create({ data: data as never, select: { id: true, threadId: true } });
      if (!created.threadId) await prisma.emailMessage.update({ where: { id: created.id }, data: { threadId: created.id } });
    },
    async resolveThread(counterparty, subject, inReplyTo) {
      return resolveThreadId({ inReplyTo, subject, counterpartyEmails: [counterparty] }, prismaThreadFinders());
    },
  };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { userId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return NextResponse.json({ error: "User has no email" }, { status: 400 });
  if (body.enabled) {
    await prisma.gmailSync.upsert({
      where: { userId },
      update: { status: "ACTIVE", emailAddress: user.email.toLowerCase() },
      create: { userId, emailAddress: user.email.toLowerCase(), status: "ACTIVE" },
    });
  } else {
    await prisma.gmailSync.updateMany({ where: { userId }, data: { status: "PAUSED" } });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  if (!gmailConfigured()) return NextResponse.json({ error: "Google not configured" }, { status: 400 });
  const { userId } = await ctx.params;
  const row = await prisma.gmailSync.findUnique({ where: { userId } });
  if (!row || row.status === "PAUSED") return NextResponse.json({ error: "Not enabled" }, { status: 400 });
  try {
    const client = makeGmailClient(row.emailAddress);
    const res = await syncOneMailbox({ repEmail: row.emailAddress, repUserId: userId, historyId: row.historyId }, client, makeDeps());
    await prisma.gmailSync.update({ where: { userId }, data: { historyId: res.newHistoryId, lastSyncedAt: new Date(), lastError: null, status: "ACTIVE", syncedCount: { increment: res.stored } } });
    return NextResponse.json({ ok: true, stored: res.stored });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "sync failed";
    await prisma.gmailSync.update({ where: { userId }, data: { status: "ERROR", lastError: msg.slice(0, 500) } }).catch(() => undefined);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Server page**

```tsx
// src/app/(dashboard)/email-center/settings/gmail/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GmailSyncClient } from "./gmail-client";

export const dynamic = "force-dynamic";
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function GmailSyncSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!ADMIN_ROLES.includes(me?.role ?? "")) redirect("/email-center");
  const configured = Boolean(process.env.GOOGLE_SA_CLIENT_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY);
  return <GmailSyncClient configured={configured} />;
}
```

- [ ] **Step 4: Client (list + toggles + bulk + sync-now)**

```tsx
// src/app/(dashboard)/email-center/settings/gmail/gmail-client.tsx
"use client";

/**
 * Admin control for Gmail mailbox sync: enable/disable per rep, bulk-enable all,
 * and trigger an immediate sync. Salesforce Einstein Activity Capture style.
 */
import { useCallback, useEffect, useState } from "react";

interface Row {
  id: string;
  name: string;
  email: string;
  gmailSync: { status: string; lastSyncedAt: string | null; lastError: string | null; syncedCount: number } | null;
}

export function GmailSyncClient({ configured }: { configured: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/email-center/gmail/mailboxes");
    const data = await res.json().catch(() => ({ items: [] }));
    setRows(data.items ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load flips loading before fetching, matching the app pattern
    void load();
  }, [load]);

  async function toggle(row: Row, enabled: boolean) {
    setBusy(row.id);
    await fetch(`/api/email-center/gmail/mailboxes/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    await load();
    setBusy(null);
  }
  async function syncNow(row: Row) {
    setBusy(row.id);
    await fetch(`/api/email-center/gmail/mailboxes/${row.id}`, { method: "POST" });
    await load();
    setBusy(null);
  }
  async function bulkEnable() {
    setBusy("bulk");
    await fetch("/api/email-center/gmail/mailboxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bulkEnableAll: true }) });
    await load();
    setBusy(null);
  }

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Mailbox Sync</h1>
          <p className="ec-flows-sub">Connect reps&apos; Google mailboxes so their client email flows into the CRM. Only mail matching a lead, contact, or account is stored.</p>
        </div>
        <button className="ec-btn ec-btn-primary" disabled={busy === "bulk"} onClick={() => void bulkEnable()}>Enable all reps</button>
      </div>
      {!configured ? (
        <div className="ec-pill ec-pill-amber" style={{ marginBottom: 14 }}>
          Google service account not configured yet. Set GOOGLE_SA_CLIENT_EMAIL and GOOGLE_SA_PRIVATE_KEY to start syncing.
        </div>
      ) : null}
      {loading ? (
        <div className="ec-empty" style={{ paddingTop: 40 }}><div className="ec-empty-sub">Loading...</div></div>
      ) : (
        <div className="ec-flows-list" style={{ maxWidth: 920 }}>
          {rows.map((row) => {
            const on = row.gmailSync?.status === "ACTIVE";
            const err = row.gmailSync?.status === "ERROR";
            return (
              <div key={row.id} className="ec-flow-row">
                <button className={`ec-switch${on ? " ec-switch-on" : ""}`} disabled={busy === row.id} onClick={() => void toggle(row, !on)}>
                  <span className="ec-switch-knob" />
                </button>
                <span className="ec-flow-main">
                  <span className="ec-flow-name">{row.name}</span>
                  <span className="ec-flow-desc">{row.email}{row.gmailSync?.lastSyncedAt ? ` · last synced ${new Date(row.gmailSync.lastSyncedAt).toLocaleString()}` : ""}{err && row.gmailSync?.lastError ? ` · error: ${row.gmailSync.lastError.slice(0, 60)}` : ""}</span>
                </span>
                {row.gmailSync?.syncedCount ? <span className="ec-pill ec-pill-neutral">{row.gmailSync.syncedCount} synced</span> : null}
                <span className={`ec-pill ${err ? "ec-pill-danger" : on ? "ec-pill-live" : "ec-pill-neutral"}`}>{err ? "error" : on ? "on" : "off"}</span>
                {on ? <button className="ec-btn ec-btn-ghost" disabled={busy === row.id} onClick={() => void syncNow(row)}>Sync now</button> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Rail entry (admin-only)**

In `src/app/(dashboard)/email-center/tab-rail.tsx`, add a "Mailbox Sync" tab to the Messaging TABS list pointing to `/email-center/settings/gmail`. (The page itself redirects non-admins, so a role check on the rail is optional; if the rail already receives a role prop, gate it, otherwise leave the page-level redirect as the guard.)

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "gmail" || echo CLEAN`; dev compile check on `/email-center/settings/gmail` (307/redirect ok).

```bash
git add src/app/api/email-center/gmail "src/app/(dashboard)/email-center/settings/gmail" "src/app/(dashboard)/email-center/tab-rail.tsx"
git commit -m "Gmail sync: admin UI to enable/disable/bulk/sync-now"
```

---

### Task 8: Full verification + E2E (mocked) + cron wiring

- [ ] **Step 1: Suite + build + lint**

Run: `npx vitest run` (gmail-map + gmail-sync + gmail-dedup green), `npm run build`, `npx eslint "src/app/(dashboard)/email-center" src/lib/google 2>&1 | tail -3`.

- [ ] **Step 2: Browser E2E of the admin UI + a mocked sync**

Since there are no real Google creds locally, verify the control plane + the sync pipeline against seeded data:
1. Seed (throwaway tsx): an admin user; a rep user with email `rep@coastaldebt.com`; a Lead with email `client@brightpath.com`.
2. Dev server (PORT chosen), log in as admin, open `/email-center/settings/gmail`: the rep appears, shows "off", the "not configured" amber note shows (no creds). Toggle the rep on -> a GmailSync row is created (verify in DB), pill flips to "on".
3. Sync pipeline (unit-level already covered; do a DB-backed check): run a throwaway tsx that constructs `makeDeps()`-equivalent against the real prisma and calls `syncOneMailbox` with the FAKE client from the test (a couple of messages, one matching `client@brightpath.com`, one not) -> assert one EmailMessage row with provider GMAIL, leadId set, threadId self-anchored, and the non-matching one skipped. Delete the rows after.
4. Cron/auth: `curl` the sync endpoint with a wrong bearer -> 401; right bearer -> `{ ok: false, skipped: "GOOGLE_SA not configured" }`.
5. Clean up all seed rows + scripts; kill server; `git status --short` clean.

- [ ] **Step 3: Wire the mini cron (local file, documented for prod)**

Add to `~/crm-cron/run.sh` (the mini) a per-run call:
```sh
G=$(curl -s -m 90 -X POST "$BASE/api/email-center/gmail/sync" -H "$AUTH")
```
and include `gmail=$G` in the `log` line. (Runs every minute; harmless while GOOGLE_SA is unset - returns skipped.) This is a local ops file, not committed to the repo.

- [ ] **Step 4: Commit anything outstanding; do NOT push**

Deploy checklist for the final report:
- Set `GOOGLE_SA_CLIENT_EMAIL` + `GOOGLE_SA_PRIVATE_KEY` on Railway (from the service-account JSON; keep the `\n` escaping in the private key or store with real newlines).
- Google Cloud: project + Gmail API enabled + service account with domain-wide delegation.
- Workspace Admin -> Security -> API Controls -> Domain-wide delegation: authorize the SA client id for scope `https://www.googleapis.com/auth/gmail.readonly`.
- Deploy (schema applies on boot). Add the gmail sync line to the mini cron.
- In the CRM, admin opens Mailbox Sync -> "Enable all reps" (or per rep) -> "Sync now" on one to verify, then the cron takes over.
- First sync per rep backfills 30 days; only CRM-matching mail is stored.
