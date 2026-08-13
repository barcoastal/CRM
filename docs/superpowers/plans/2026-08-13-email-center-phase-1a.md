# Email Center Phase 1a Implementation Plan (Shell + Per-User Inbox)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `/email-center` hub in Coastal CRM with a per-user threaded inbox: each agent sees and sends their own mail from a personal CRM address, admins see everyone's.

**Architecture:** Reuse the existing EmailMessage pipeline (Resend sender, inbound webhook, compose API). Add threading fields + a thread resolver lib, route inbound mail to users by a new `User.mailboxAddress`, and build a thread-centric inbox UI under a new Email Center shell with placeholder tabs for Phase 1b/1c features.

**Tech Stack:** Next.js App Router, Prisma (Postgres, `prisma db push`, no migrations dir), Resend, vitest (tests in `tests/*.test.ts`, node env).

**Spec:** `docs/superpowers/specs/2026-08-13-email-center-design.md`

**Codebase facts the engineer needs:**
- Prisma schema: `prisma/schema.prisma`. `EmailMessage` is at ~line 1900 and ALREADY has `ownerId`, `massEmailId`, `trackingId`, `openCount`, `clickCount`. `User` is at ~line 12.
- Schema changes deploy with `npx prisma db push` (there is no `prisma/migrations` directory).
- Auth in API routes: `const r = await requireAuthOrRespond("Email.Send"); if ("response" in r) return r.response;` from `@/lib/api-auth`. Session fields: `r.session.userId`, `r.session.role`.
- Admin gate pattern (same as feedback route): `const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];`
- Outbound send: `sendQueuedEmail(id)` in `src/lib/email-sender.ts`; low-level `sendViaResend` posts JSON to `https://api.resend.com/emails`.
- Inbound webhook: `src/app/api/emails/webhook/inbound/route.ts` (Resend inbound, svix signature, currently owner = related record's owner).
- Compose: `src/app/api/emails/compose/route.ts` (already sends from the logged-in user's email and sets `ownerId`).
- Global nav: `NAV` array in `src/components/slds/header.tsx` (~line 42).
- Tests: `npm run test` (vitest, includes `tests/**/*.test.ts`). Keep new tests pure (no DB): inject finder callbacks.
- UI font/style: existing pages use SLDS-ish classes and inline styles; follow `src/app/(dashboard)/emails/inbox-client.tsx` for tone.
- Do not use em dashes in any generated content (user rule).

---

### Task 1: Schema fields for mailboxes and threading

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `mailboxAddress` to User**

In `model User`, after the `isCloser` line, add:

```prisma
  mailboxAddress String? @unique // per-user CRM inbox address, e.g. bar@coastaldebt.com; provisioned by admins
```

- [ ] **Step 2: Add threading fields to EmailMessage**

In `model EmailMessage`, after the `sfId` line, add:

```prisma
  // Inbox threading (Email Center). threadId = id of the first message in the
  // conversation. subjectNorm = lowercased subject with re:/fwd: prefixes
  // stripped, used for fallback thread matching. messageIdHeader / inReplyTo
  // carry RFC 5322 ids (inbound gives us both; outbound Resend sends get
  // inReplyTo when composed as a reply). readAt = when the owner opened it.
  threadId        String?
  subjectNorm     String?
  messageIdHeader String?
  inReplyTo       String?
  readAt          DateTime?
```

And add to the existing `@@index` block of `EmailMessage` (keep existing indexes):

```prisma
  @@index([threadId])
  @@index([subjectNorm])
  @@index([ownerId])
```

If `@@index([ownerId])` already exists in the model, skip that one line.

- [ ] **Step 3: Push schema and regenerate client**

Run: `npx prisma db push && npx prisma generate`
Expected: "Your database is now in sync with your Prisma schema" and client generation success.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "Email Center: mailboxAddress on User, threading fields on EmailMessage"
```

---

### Task 2: Threading resolver lib (TDD)

**Files:**
- Create: `src/lib/email/threading.ts`
- Test: `tests/email-threading.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/email-threading.test.ts
import { describe, it, expect } from "vitest";
import {
  normalizeSubject,
  extractEmails,
  resolveThreadId,
  type ThreadFinders,
} from "@/lib/email/threading";

describe("normalizeSubject", () => {
  it("strips re/fw/fwd prefixes repeatedly and lowercases", () => {
    expect(normalizeSubject("Re: RE: Fwd: Your settlement offer ")).toBe("your settlement offer");
    expect(normalizeSubject("FW:Payment plan")).toBe("payment plan");
    expect(normalizeSubject("Hello")).toBe("hello");
    expect(normalizeSubject("")).toBe("");
  });
});

describe("extractEmails", () => {
  it("parses display names and CSV lists", () => {
    expect(extractEmails('Joe Sullivan <joe@x.com>, "Ann" <ann@y.com>')).toEqual([
      "joe@x.com",
      "ann@y.com",
    ]);
    expect(extractEmails("plain@x.com")).toEqual(["plain@x.com"]);
    expect(extractEmails(null)).toEqual([]);
    expect(extractEmails("not-an-email")).toEqual([]);
  });
});

function finders(overrides: Partial<ThreadFinders>): ThreadFinders {
  return {
    byMessageIdHeader: async () => null,
    bySubjectAndCounterparty: async () => null,
    ...overrides,
  };
}

describe("resolveThreadId", () => {
  it("prefers inReplyTo match and returns its threadId", async () => {
    const f = finders({
      byMessageIdHeader: async (mid) =>
        mid === "<abc@x.com>" ? { id: "m1", threadId: "t1" } : null,
    });
    const r = await resolveThreadId(
      { inReplyTo: "<abc@x.com>", subject: "Re: hi", counterpartyEmails: ["joe@x.com"] },
      f,
    );
    expect(r).toBe("t1");
  });

  it("falls back to parent id when parent has no threadId", async () => {
    const f = finders({
      byMessageIdHeader: async () => ({ id: "m1", threadId: null }),
    });
    const r = await resolveThreadId(
      { inReplyTo: "<abc@x.com>", subject: "Re: hi", counterpartyEmails: [] },
      f,
    );
    expect(r).toBe("m1");
  });

  it("falls back to subject + counterparty match", async () => {
    const f = finders({
      bySubjectAndCounterparty: async (subjectNorm, emails) =>
        subjectNorm === "your offer" && emails.includes("joe@x.com")
          ? { id: "m2", threadId: "t2" }
          : null,
    });
    const r = await resolveThreadId(
      { inReplyTo: null, subject: "RE: Your offer", counterpartyEmails: ["joe@x.com"] },
      f,
    );
    expect(r).toBe("t2");
  });

  it("returns null for a brand new conversation", async () => {
    const r = await resolveThreadId(
      { inReplyTo: null, subject: "New topic", counterpartyEmails: ["joe@x.com"] },
      finders({}),
    );
    expect(r).toBeNull();
  });

  it("returns null when subject is empty after normalization", async () => {
    const f = finders({
      bySubjectAndCounterparty: async () => ({ id: "m9", threadId: "t9" }),
    });
    const r = await resolveThreadId(
      { inReplyTo: null, subject: "Re:", counterpartyEmails: ["joe@x.com"] },
      f,
    );
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/email-threading.test.ts`
Expected: FAIL, cannot resolve `@/lib/email/threading`.

- [ ] **Step 3: Implement the lib**

```typescript
// src/lib/email/threading.ts
/**
 * Conversation threading for the Email Center inbox.
 *
 * Thread resolution order:
 *   1. RFC In-Reply-To header match against stored messageIdHeader.
 *   2. Fallback: same normalized subject + shared counterparty address within
 *      the last 30 days.
 *   3. No match: caller creates the message, then sets threadId = its own id.
 *
 * DB access is injected via ThreadFinders so the logic is unit-testable;
 * prismaThreadFinders() is the production implementation.
 */
import { prisma } from "@/lib/prisma";

const SUBJECT_PREFIX = /^(re|fw|fwd)\s*:\s*/i;

export function normalizeSubject(subject: string): string {
  let s = (subject ?? "").trim();
  while (SUBJECT_PREFIX.test(s)) s = s.replace(SUBJECT_PREFIX, "");
  return s.trim().toLowerCase();
}

/** Parse "Name <a@b>, c@d" style strings into lowercase bare addresses. */
export function extractEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => {
      const m = part.match(/<([^>]+)>/);
      return (m?.[1] ?? part).replace(/"/g, "").trim().toLowerCase();
    })
    .filter((e) => e.includes("@"));
}

export interface ThreadCandidate {
  inReplyTo?: string | null;
  subject: string;
  counterpartyEmails: string[];
}

export interface ThreadFinders {
  byMessageIdHeader(messageId: string): Promise<{ id: string; threadId: string | null } | null>;
  bySubjectAndCounterparty(
    subjectNorm: string,
    emails: string[],
    since: Date,
  ): Promise<{ id: string; threadId: string | null } | null>;
}

export async function resolveThreadId(
  c: ThreadCandidate,
  find: ThreadFinders,
  now: Date = new Date(),
): Promise<string | null> {
  if (c.inReplyTo) {
    const parent = await find.byMessageIdHeader(c.inReplyTo);
    if (parent) return parent.threadId ?? parent.id;
  }
  const subjectNorm = normalizeSubject(c.subject);
  if (!subjectNorm || c.counterpartyEmails.length === 0) return null;
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const match = await find.bySubjectAndCounterparty(subjectNorm, c.counterpartyEmails, since);
  if (match) return match.threadId ?? match.id;
  return null;
}

export function prismaThreadFinders(): ThreadFinders {
  return {
    async byMessageIdHeader(messageId) {
      return prisma.emailMessage.findFirst({
        where: {
          OR: [{ messageIdHeader: messageId }, { providerMessageId: messageId }],
        },
        select: { id: true, threadId: true },
      });
    },
    async bySubjectAndCounterparty(subjectNorm, emails, since) {
      if (emails.length === 0) return null;
      return prisma.emailMessage.findFirst({
        where: {
          subjectNorm,
          createdAt: { gte: since },
          OR: emails.flatMap((e) => [
            { fromAddress: { contains: e, mode: "insensitive" as const } },
            { toAddresses: { contains: e, mode: "insensitive" as const } },
          ]),
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, threadId: true },
      });
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/email-threading.test.ts`
Expected: all tests PASS. Note: importing `@/lib/prisma` at module top is fine in tests because it only instantiates a client, it does not connect until queried, and the finder tests never touch it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/threading.ts tests/email-threading.test.ts
git commit -m "Email Center: threading resolver lib with unit tests"
```

---

### Task 3: Inbound webhook routes mail to user mailboxes + threads

**Files:**
- Modify: `src/app/api/emails/webhook/inbound/route.ts`

- [ ] **Step 1: Add mailbox routing and threading to the webhook**

Replace the owner-resolution and create sections (everything from the `// Try to match by sender email` comment through the final `prisma.emailMessage.create`) with:

```typescript
  // Try to match by sender email -> Lead / Contact / Account / Opportunity
  const [lead, contact, account, opp] = await Promise.all([
    prisma.lead.findFirst({ where: { email: { equals: fromEmail, mode: "insensitive" } }, select: { id: true, assignedToId: true } }),
    prisma.contact.findFirst({ where: { email: { equals: fromEmail, mode: "insensitive" } }, select: { id: true, ownerId: true } }),
    prisma.account.findFirst({ where: { email: { equals: fromEmail, mode: "insensitive" } }, select: { id: true, ownerId: true } }),
    prisma.opportunity.findFirst({ where: { oppEmail: { equals: fromEmail, mode: "insensitive" } }, select: { id: true, assignedToId: true } }),
  ]);

  // Owner priority: 1) the user whose mailboxAddress is in to/cc,
  // 2) the related record's owner, 3) an admin catch-all, 4) any user.
  const recipientEmails = [...toArr, ...ccArr].flatMap((r) => extractEmails(r));
  const mailboxUser = recipientEmails.length
    ? await prisma.user.findFirst({
        where: { mailboxAddress: { in: recipientEmails, mode: "insensitive" }, isActive: true },
        select: { id: true },
      })
    : null;

  let ownerId: string | null =
    mailboxUser?.id ??
    lead?.assignedToId ?? contact?.ownerId ?? account?.ownerId ?? opp?.assignedToId ?? null;
  if (!ownerId) {
    const admin = await prisma.user.findFirst({ where: { role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER"] } }, select: { id: true } });
    ownerId = admin?.id ?? null;
  }
  if (!ownerId) {
    const anyUser = await prisma.user.findFirst({ select: { id: true } });
    ownerId = anyUser?.id ?? null;
  }
  if (!ownerId) return NextResponse.json({ error: "no owner candidate" }, { status: 500 });

  // De-dup by providerMessageId
  if (messageId) {
    const existing = await prisma.emailMessage.findFirst({
      where: { providerMessageId: messageId },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ ok: true, id: existing.id, dedup: true });
  }
  void receivedAt; // EmailMessage uses createdAt as the received timestamp

  const threadId = await resolveThreadId(
    { inReplyTo: inReplyTo || null, subject, counterpartyEmails: [fromEmail] },
    prismaThreadFinders(),
  );

  const created = await prisma.emailMessage.create({
    data: {
      direction: "INBOUND",
      status: "DELIVERED",
      fromAddress: fromRaw,
      toAddresses: toArr.join(", "),
      cc: ccArr.length ? ccArr.join(", ") : null,
      subject,
      subjectNorm: normalizeSubject(subject),
      bodyHtml: html,
      bodyText: text,
      providerMessageId: messageId || null,
      messageIdHeader: messageId || null,
      inReplyTo: inReplyTo || null,
      threadId,
      provider: "RESEND_INBOUND",
      leadId: lead?.id ?? null,
      contactId: contact?.id ?? null,
      accountId: account?.id ?? null,
      opportunityId: opp?.id ?? null,
      ownerId,
    },
    select: { id: true, threadId: true },
  });

  // A brand new conversation threads to itself.
  if (!created.threadId) {
    await prisma.emailMessage.update({ where: { id: created.id }, data: { threadId: created.id } });
  }

  return NextResponse.json({
    ok: true,
    id: created.id,
    matched: { mailbox: !!mailboxUser, lead: !!lead, contact: !!contact, account: !!account, opportunity: !!opp },
  });
```

Add the import at the top of the file:

```typescript
import { extractEmails, normalizeSubject, prismaThreadFinders, resolveThreadId } from "@/lib/email/threading";
```

The local `extractEmail` (singular) helper stays for `fromEmail`; also delete the now-unused `void inReplyTo;` line.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i "webhook/inbound" || echo CLEAN`
Expected: CLEAN (ignore unrelated pre-existing errors elsewhere; if `npx tsc --noEmit` is too slow, `npm run build` in Task 8 is the backstop).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/emails/webhook/inbound/route.ts
git commit -m "Inbound email routes to user mailboxes and resolves conversation threads"
```

---

### Task 4: Compose supports replies, mailbox from-address, and thread stamping

**Files:**
- Modify: `src/app/api/emails/compose/route.ts`
- Modify: `src/lib/email-sender.ts`

- [ ] **Step 1: Extend the compose route**

Replace the body of `POST` in `src/app/api/emails/compose/route.ts` with:

```typescript
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    templateId?: string;
    leadId?: string;
    opportunityId?: string;
    accountId?: string;
    contactId?: string;
    creditorId?: string;
    caseId?: string;
    replyToMessageId?: string;
    sendNow?: boolean;
  };

  // Reply mode: inherit thread, record links, recipient, and subject from the parent.
  let parent: {
    id: string;
    threadId: string | null;
    subject: string;
    fromAddress: string;
    messageIdHeader: string | null;
    leadId: string | null;
    contactId: string | null;
    accountId: string | null;
    opportunityId: string | null;
    caseId: string | null;
  } | null = null;
  if (body.replyToMessageId) {
    parent = await prisma.emailMessage.findUnique({
      where: { id: body.replyToMessageId },
      select: {
        id: true, threadId: true, subject: true, fromAddress: true, messageIdHeader: true,
        leadId: true, contactId: true, accountId: true, opportunityId: true, caseId: true,
      },
    });
    if (!parent) return NextResponse.json({ error: "replyToMessageId not found" }, { status: 404 });
  }

  const to = body.to ?? (parent ? extractEmails(parent.fromAddress).join(", ") : undefined);
  if (!to) return NextResponse.json({ error: "to required" }, { status: 400 });

  const subject =
    body.subject ??
    (parent ? (parent.subject.match(/^re:/i) ? parent.subject : `Re: ${parent.subject}`) : "");

  // Send "from" the user's provisioned CRM mailbox so replies route back to
  // their Email Center inbox; fall back to their login email, then env default.
  const sender = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, mailboxAddress: true },
  });
  const defaultFrom = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
  const senderAddress = sender?.mailboxAddress ?? sender?.email;
  const fromAddress = senderAddress
    ? `${sender?.name ?? senderAddress} <${senderAddress}>`
    : defaultFrom;

  const msg = await prisma.emailMessage.create({
    data: {
      direction: "OUTBOUND",
      status: "QUEUED",
      fromAddress,
      toAddresses: to,
      cc: body.cc ?? null,
      bcc: body.bcc ?? null,
      subject,
      subjectNorm: normalizeSubject(subject),
      bodyHtml: body.bodyHtml ?? null,
      bodyText: body.bodyText ?? null,
      templateId: body.templateId ?? null,
      leadId: body.leadId ?? parent?.leadId ?? null,
      opportunityId: body.opportunityId ?? parent?.opportunityId ?? null,
      accountId: body.accountId ?? parent?.accountId ?? null,
      contactId: body.contactId ?? parent?.contactId ?? null,
      caseId: body.caseId ?? parent?.caseId ?? null,
      threadId: parent ? (parent.threadId ?? parent.id) : null,
      inReplyTo: parent?.messageIdHeader ?? null,
      ownerId: session.user.id,
    },
    select: { id: true, threadId: true },
  });
  if (!msg.threadId) {
    await prisma.emailMessage.update({ where: { id: msg.id }, data: { threadId: msg.id } });
  }

  if (body.sendNow !== false) {
    const result = await sendQueuedEmail(msg.id);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, id: msg.id, error: result.error ?? "send failed" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, id: msg.id, providerMessageId: result.providerMessageId });
  }
  return NextResponse.json({ ok: true, id: msg.id, queued: true });
}
```

Add to the imports:

```typescript
import { extractEmails, normalizeSubject } from "@/lib/email/threading";
```

- [ ] **Step 2: Pass In-Reply-To headers through the Resend sender**

In `src/lib/email-sender.ts`:

a) Add `headers` to the `sendViaResend` args type (after `replyTo`):

```typescript
  headers?: Record<string, string> | null;
```

b) In the `body` construction inside `sendViaResend`, after the `reply_to` line, add:

```typescript
  if (args.headers && Object.keys(args.headers).length > 0) body.headers = args.headers;
```

c) Find the call site inside `sendQueuedEmail` where `sendViaResend({ ... })` is invoked with the message fields, and add to its argument object:

```typescript
    headers: msg.inReplyTo
      ? { "In-Reply-To": msg.inReplyTo, References: msg.inReplyTo }
      : null,
```

The `msg` variable there is the loaded `EmailMessage`, which now has `inReplyTo` from Task 1.

- [ ] **Step 3: Typecheck and run existing tests**

Run: `npx vitest run && npx tsc --noEmit 2>&1 | grep -iE "compose|email-sender" || echo CLEAN`
Expected: vitest PASS, tsc CLEAN for these files.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/emails/compose/route.ts src/lib/email-sender.ts
git commit -m "Compose replies: thread stamping, mailbox from-address, In-Reply-To headers"
```

---

### Task 5: Admin provisioning of mailbox addresses

**Files:**
- Modify: `src/app/api/users/[id]/route.ts`
- Modify: `src/app/(dashboard)/settings/users/[id]/edit/` (the edit form component in that folder)

- [ ] **Step 1: Accept mailboxAddress in the users PATCH API**

In `src/app/api/users/[id]/route.ts`:

a) Add to `updateUserSchema` (after `five9Username`):

```typescript
  mailboxAddress: z.string().email().max(255).optional().nullable(),
```

b) After the existing email-dupe check, add a mailbox-dupe check:

```typescript
  if (d.mailboxAddress && d.mailboxAddress !== before.mailboxAddress) {
    const dupe = await prisma.user.findFirst({ where: { mailboxAddress: { equals: d.mailboxAddress, mode: "insensitive" } } });
    if (dupe && dupe.id !== id) return NextResponse.json({ error: "Mailbox address already in use" }, { status: 409 });
  }
```

c) Add to the `data` assembly (after the `five9Username` line):

```typescript
  if (d.mailboxAddress !== undefined) data.mailboxAddress = d.mailboxAddress ? d.mailboxAddress.toLowerCase() : null;
```

- [ ] **Step 2: Add the field to the user edit form**

Open the edit form component under `src/app/(dashboard)/settings/users/[id]/edit/`. Find where the `five9Username` (or `isCloser`) input is rendered and its state/submit handling, then mirror that exact pattern for `mailboxAddress`:

1. Add `mailboxAddress` to the form state, initialized from the loaded user (extend the GET select in `src/app/api/users/[id]/route.ts` or the server page query to include `mailboxAddress: true` if the form loads via either).
2. Add a labeled text input:

```tsx
<div>
  <label className="slds-form-element__label" htmlFor="mailboxAddress">
    Email Center Mailbox
  </label>
  <input
    id="mailboxAddress"
    type="email"
    className="slds-input"
    placeholder="agent@coastaldebt.com"
    value={form.mailboxAddress ?? ""}
    onChange={(e) => setForm((f) => ({ ...f, mailboxAddress: e.target.value }))}
  />
  <p style={{ fontSize: 11, color: "#706e6b", marginTop: 2 }}>
    Inbound mail to this address lands in the user&apos;s Email Center inbox. Leave empty to disable.
  </p>
</div>
```

Adapt the state accessors (`form` / `setForm`) to whatever the file actually uses; keep its exact styling conventions.
3. Include `mailboxAddress: form.mailboxAddress || null` in the PATCH payload on save.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open Settings > Users > any user > Edit, set a mailbox address, save, reload. Confirm it persists and that saving a duplicate on a second user returns the 409 error.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/users/[id]/route.ts" "src/app/(dashboard)/settings/users/[id]/edit"
git commit -m "Admins can provision per-user Email Center mailbox addresses"
```

---

### Task 6: Email Center shell, placeholder tabs, and nav entry

**Files:**
- Create: `src/app/(dashboard)/email-center/layout.tsx`
- Create: `src/app/(dashboard)/email-center/coming-soon.tsx`
- Create: `src/app/(dashboard)/email-center/campaigns/page.tsx`
- Create: `src/app/(dashboard)/email-center/flows/page.tsx`
- Create: `src/app/(dashboard)/email-center/segments/page.tsx`
- Create: `src/app/(dashboard)/email-center/reports/page.tsx`
- Create: `src/app/(dashboard)/email-center/domain-health/page.tsx`
- Modify: `src/components/slds/header.tsx`

- [ ] **Step 1: Create the shell layout with tab rail**

```tsx
// src/app/(dashboard)/email-center/layout.tsx
import Link from "next/link";
import type { ReactNode } from "react";

const TABS = [
  { href: "/email-center", label: "Inbox" },
  { href: "/email-center/campaigns", label: "Campaigns" },
  { href: "/email-center/flows", label: "Flows" },
  { href: "/email-center/segments", label: "Segments" },
  { href: "/email-templates", label: "Templates" },
  { href: "/email-center/reports", label: "Reports" },
  { href: "/email-center/domain-health", label: "Domain Health" },
];

export default function EmailCenterLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", height: "calc(100vh - 90px)", background: "#f3f3f3" }}>
      <nav
        style={{
          width: 180,
          flexShrink: 0,
          background: "#fff",
          borderRight: "1px solid #e5e5e5",
          padding: "12px 0",
        }}
      >
        <div style={{ padding: "0 16px 10px", fontSize: 15, fontWeight: 700, color: "#181818" }}>
          Email Center
        </div>
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            style={{
              display: "block",
              padding: "7px 16px",
              fontSize: 13,
              color: "#181818",
              textDecoration: "none",
            }}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <main style={{ flex: 1, minWidth: 0, overflow: "auto" }}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create the shared placeholder component and the five placeholder pages**

```tsx
// src/app/(dashboard)/email-center/coming-soon.tsx
import Link from "next/link";

export function ComingSoon({
  title,
  phase,
  existingLabel,
  existingHref,
}: {
  title: string;
  phase: string;
  existingLabel?: string;
  existingHref?: string;
}) {
  return (
    <div style={{ padding: 40, maxWidth: 560 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e5e5",
          borderRadius: 8,
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
        <p style={{ fontSize: 13, color: "#444", marginBottom: 12 }}>
          Coming in {phase} of the Email Center build.
        </p>
        {existingHref ? (
          <p style={{ fontSize: 13 }}>
            Until then, use <Link href={existingHref} style={{ color: "#0176d3" }}>{existingLabel}</Link>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
```

```tsx
// src/app/(dashboard)/email-center/campaigns/page.tsx
import { ComingSoon } from "../coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Campaigns"
      phase="Phase 1b"
      existingLabel="Mass Email"
      existingHref="/emails/mass"
    />
  );
}
```

```tsx
// src/app/(dashboard)/email-center/flows/page.tsx
import { ComingSoon } from "../coming-soon";

export default function Page() {
  return (
    <ComingSoon
      title="Flows"
      phase="Phase 1c"
      existingLabel="Automation Flows"
      existingHref="/automation/flows"
    />
  );
}
```

```tsx
// src/app/(dashboard)/email-center/segments/page.tsx
import { ComingSoon } from "../coming-soon";

export default function Page() {
  return <ComingSoon title="Segments" phase="Phase 1b" />;
}
```

```tsx
// src/app/(dashboard)/email-center/reports/page.tsx
import { ComingSoon } from "../coming-soon";

export default function Page() {
  return <ComingSoon title="Reports" phase="Phase 1c" />;
}
```

```tsx
// src/app/(dashboard)/email-center/domain-health/page.tsx
import { ComingSoon } from "../coming-soon";

export default function Page() {
  return <ComingSoon title="Domain Health" phase="Phase 1c" />;
}
```

- [ ] **Step 3: Add the nav entry**

In `src/components/slds/header.tsx`, in the `NAV` array, after the `{ label: "Emails", href: "/emails", entity: "Email" },` line, add:

```typescript
  { label: "Email Center", href: "/email-center", entity: "Email" },
```

- [ ] **Step 4: Verify the shell renders**

Run: `npm run dev`, open `/email-center/campaigns`. Expected: Email Center left rail with 7 tabs; Campaigns shows the Phase 1b card linking to Mass Email.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/email-center" src/components/slds/header.tsx
git commit -m "Email Center shell: tab rail, placeholder pages, nav entry"
```

---

### Task 7: Per-user threaded inbox (API + UI)

**Files:**
- Create: `src/app/api/email-center/threads/route.ts`
- Create: `src/app/api/email-center/threads/read/route.ts`
- Create: `src/app/(dashboard)/email-center/page.tsx`
- Create: `src/app/(dashboard)/email-center/inbox-client.tsx`

- [ ] **Step 1: Thread list API**

```typescript
// src/app/api/email-center/threads/route.ts
/**
 * GET /api/email-center/threads?folder=inbox|sent|all&user=<userId|all>
 *
 * Returns the caller's conversations (grouped by threadId), newest activity
 * first. Admins (SUPER_ADMIN / ADMIN / MANAGER) may pass ?user= to view
 * another user's inbox or "all" for everyone's.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") ?? "inbox";
  const isAdmin = ADMIN_ROLES.includes(r.session.role);
  const userParam = url.searchParams.get("user");

  let ownerFilter: { ownerId?: string } = { ownerId: r.session.userId };
  if (isAdmin && userParam === "all") ownerFilter = {};
  else if (isAdmin && userParam) ownerFilter = { ownerId: userParam };

  const directionFilter =
    folder === "inbox"
      ? { direction: "INBOUND" }
      : folder === "sent"
        ? { direction: "OUTBOUND" }
        : {};

  // Latest 500 messages in scope, grouped into threads in JS. threadId is
  // always set for new mail; legacy rows without one thread as themselves.
  const messages = await prisma.emailMessage.findMany({
    where: { ...ownerFilter, ...directionFilter },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      threadId: true,
      direction: true,
      status: true,
      fromAddress: true,
      toAddresses: true,
      subject: true,
      bodyText: true,
      bodyHtml: true,
      readAt: true,
      sentAt: true,
      createdAt: true,
      leadId: true,
      accountId: true,
      contactId: true,
      owner: { select: { id: true, name: true } },
      lead: { select: { id: true, contactName: true } },
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, fullName: true } },
    },
  });

  const threads = new Map<string, {
    threadId: string;
    subject: string;
    lastAt: string;
    lastFrom: string;
    lastDirection: string;
    snippet: string;
    messageCount: number;
    unreadCount: number;
    ownerName: string | null;
    leadId: string | null;
    leadName: string | null;
    accountId: string | null;
    accountName: string | null;
    contactId: string | null;
    contactName: string | null;
  }>();

  for (const m of messages) {
    const key = m.threadId ?? m.id;
    const unread = m.direction === "INBOUND" && !m.readAt ? 1 : 0;
    const existing = threads.get(key);
    if (!existing) {
      const text = (m.bodyText ?? m.bodyHtml?.replace(/<[^>]+>/g, " ") ?? "").trim();
      threads.set(key, {
        threadId: key,
        subject: m.subject || "(no subject)",
        lastAt: (m.sentAt ?? m.createdAt).toISOString(),
        lastFrom: m.fromAddress,
        lastDirection: m.direction,
        snippet: text.slice(0, 120),
        messageCount: 1,
        unreadCount: unread,
        ownerName: m.owner?.name ?? null,
        leadId: m.leadId,
        leadName: m.lead?.contactName ?? null,
        accountId: m.accountId,
        accountName: m.account?.name ?? null,
        contactId: m.contactId,
        contactName: m.contact?.fullName ?? null,
      });
    } else {
      existing.messageCount += 1;
      existing.unreadCount += unread;
    }
  }

  return NextResponse.json({ threads: [...threads.values()] });
}
```

- [ ] **Step 2: Mark-thread-read API**

```typescript
// src/app/api/email-center/threads/read/route.ts
/** POST { threadId } marks all of the caller's inbound messages in the thread read. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const body = (await req.json().catch(() => ({}))) as { threadId?: string };
  if (!body.threadId) return NextResponse.json({ error: "threadId required" }, { status: 400 });
  const updated = await prisma.emailMessage.updateMany({
    where: {
      OR: [{ threadId: body.threadId }, { id: body.threadId }],
      ownerId: r.session.userId,
      direction: "INBOUND",
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true, marked: updated.count });
}
```

- [ ] **Step 3: Inbox server page**

```tsx
// src/app/(dashboard)/email-center/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function EmailCenterInboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, mailboxAddress: true },
  });
  if (!me) redirect("/login");
  const isAdmin = ADMIN_ROLES.includes(me.role);

  const users = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, mailboxAddress: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <InboxClient
      me={{ id: me.id, name: me.name, mailboxAddress: me.mailboxAddress }}
      isAdmin={isAdmin}
      users={users}
    />
  );
}
```

- [ ] **Step 4: Inbox client component**

```tsx
// src/app/(dashboard)/email-center/inbox-client.tsx
"use client";

/**
 * Email Center inbox: folder rail (inbox/sent/all) + thread list +
 * conversation pane with inline reply and new-message composer. Threads and
 * messages load from /api/email-center/threads and /api/emails.
 * Admins get a user switcher (any user or "All users").
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const FONT = '"Salesforce Sans", "Helvetica Neue", system-ui, -apple-system, sans-serif';

type Folder = "inbox" | "sent" | "all";

interface ThreadRow {
  threadId: string;
  subject: string;
  lastAt: string;
  lastFrom: string;
  lastDirection: string;
  snippet: string;
  messageCount: number;
  unreadCount: number;
  ownerName: string | null;
  leadId: string | null;
  leadName: string | null;
  accountId: string | null;
  accountName: string | null;
  contactId: string | null;
  contactName: string | null;
}

interface Message {
  id: string;
  direction: string;
  status: string;
  fromAddress: string;
  toAddresses: string;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  createdAt: string;
  openCount?: number;
  clickCount?: number;
}

export function InboxClient({
  me,
  isAdmin,
  users,
}: {
  me: { id: string; name: string; mailboxAddress: string | null };
  isAdmin: boolean;
  users: { id: string; name: string; mailboxAddress: string | null }[];
}) {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [viewUser, setViewUser] = useState<string>(me.id);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ThreadRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", body: "", templateId: "" });
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email-templates")
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? data.templates ?? []);
        setTemplates(items.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      })
      .catch(() => setTemplates([]));
  }, []);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ folder });
    if (isAdmin && viewUser !== me.id) qs.set("user", viewUser);
    const res = await fetch(`/api/email-center/threads?${qs}`);
    const data = await res.json();
    setThreads(data.threads ?? []);
    setLoading(false);
  }, [folder, viewUser, isAdmin, me.id]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const openThread = useCallback(async (t: ThreadRow) => {
    setSelected(t);
    setReply("");
    const res = await fetch(`/api/emails?limit=200`);
    const data = await res.json();
    const items: (Message & { threadId?: string | null })[] = data.items ?? [];
    const inThread = items
      .filter((m) => (m.threadId ?? m.id) === t.threadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    setMessages(inThread);
    if (t.unreadCount > 0) {
      await fetch("/api/email-center/threads/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: t.threadId }),
      });
      setThreads((prev) =>
        prev.map((x) => (x.threadId === t.threadId ? { ...x, unreadCount: 0 } : x)),
      );
    }
  }, []);

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    setError(null);
    const last = messages[messages.length - 1];
    const res = await fetch("/api/emails/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replyToMessageId: last?.id ?? selected.threadId,
        bodyHtml: `<p>${reply.replace(/\n/g, "<br/>")}</p>`,
        bodyText: reply,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok || data.error) {
      setError(data.error ?? "Send failed");
      return;
    }
    setReply("");
    await openThread(selected);
    await loadThreads();
  }

  async function sendNew() {
    if (!compose.to.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/emails/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: compose.to,
        subject: compose.subject || undefined,
        bodyHtml: compose.body ? `<p>${compose.body.replace(/\n/g, "<br/>")}</p>` : undefined,
        bodyText: compose.body || undefined,
        templateId: compose.templateId || undefined,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok || data.error) {
      setError(data.error ?? "Send failed");
      return;
    }
    setComposeOpen(false);
    setCompose({ to: "", subject: "", body: "", templateId: "" });
    setFolder("sent");
  }

  const totalUnread = threads.reduce((n, t) => n + t.unreadCount, 0);

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: FONT, background: "#f3f3f3" }}>
      {/* Folder rail */}
      <div style={{ width: 150, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e5e5", padding: "12px 0" }}>
        <button
          onClick={() => { setComposeOpen(true); setSelected(null); }}
          style={{ display: "block", margin: "0 12px 12px", width: "calc(100% - 24px)", padding: "6px 0", background: "#0176d3", color: "#fff", border: 0, borderRadius: 4, fontSize: 13, cursor: "pointer" }}
        >
          New Email
        </button>
        {(["inbox", "sent", "all"] as Folder[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFolder(f); setSelected(null); }}
            style={{
              display: "flex", justifyContent: "space-between", width: "100%", padding: "6px 16px",
              background: folder === f ? "#f0f6fb" : "transparent", border: 0, fontSize: 13,
              cursor: "pointer", textTransform: "capitalize", color: "#181818",
            }}
          >
            <span>{f === "all" ? "All Mail" : f}</span>
            {f === "inbox" && totalUnread > 0 ? (
              <span style={{ background: "#0176d3", color: "#fff", borderRadius: 10, fontSize: 11, padding: "0 6px" }}>{totalUnread}</span>
            ) : null}
          </button>
        ))}
        {isAdmin ? (
          <div style={{ padding: "14px 12px 0" }}>
            <div style={{ fontSize: 11, color: "#706e6b", marginBottom: 4 }}>Viewing</div>
            <select
              value={viewUser}
              onChange={(e) => { setViewUser(e.target.value); setSelected(null); }}
              style={{ width: "100%", fontSize: 12, padding: 4 }}
            >
              <option value={me.id}>My inbox</option>
              <option value="all">All users</option>
              {users.filter((u) => u.id !== me.id).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        ) : null}
        {me.mailboxAddress ? (
          <div style={{ padding: "14px 16px 0", fontSize: 11, color: "#706e6b", wordBreak: "break-all" }}>
            {me.mailboxAddress}
          </div>
        ) : (
          <div style={{ padding: "14px 16px 0", fontSize: 11, color: "#c23934" }}>
            No mailbox address set. Ask an admin to provision one in Settings &gt; Users.
          </div>
        )}
      </div>

      {/* Thread list */}
      <div style={{ width: 340, flexShrink: 0, background: "#fff", borderRight: "1px solid #e5e5e5", overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 16, fontSize: 13, color: "#706e6b" }}>Loading...</div>
        ) : threads.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: "#706e6b" }}>No conversations.</div>
        ) : (
          threads.map((t) => (
            <button
              key={t.threadId}
              onClick={() => { setComposeOpen(false); void openThread(t); }}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
                borderBottom: "1px solid #f0f0f0", cursor: "pointer", border: 0,
                background: selected?.threadId === t.threadId ? "#f0f6fb" : "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: t.unreadCount > 0 ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.subject}
                </span>
                <span style={{ fontSize: 11, color: "#706e6b", flexShrink: 0 }}>
                  {new Date(t.lastAt).toLocaleDateString()}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#706e6b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.lastFrom}
              </div>
              <div style={{ fontSize: 12, color: "#9a9a9a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.snippet}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                {t.messageCount > 1 ? (
                  <span style={{ fontSize: 11, color: "#706e6b" }}>{t.messageCount} messages</span>
                ) : null}
                {t.unreadCount > 0 ? (
                  <span style={{ fontSize: 11, color: "#0176d3", fontWeight: 700 }}>{t.unreadCount} new</span>
                ) : null}
                {t.leadId ? (
                  <span style={{ fontSize: 11, color: "#0176d3" }}>Lead: {t.leadName ?? t.leadId}</span>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Conversation / composer pane */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {composeOpen ? (
          <div style={{ padding: 20, maxWidth: 680 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>New Email</h2>
            {templates.length > 0 ? (
              <select
                value={compose.templateId}
                onChange={(e) => setCompose((c) => ({ ...c, templateId: e.target.value }))}
                style={{ display: "block", width: "100%", marginBottom: 8, padding: 8, fontSize: 13, border: "1px solid #ddd", borderRadius: 4 }}
              >
                <option value="">No template (write below)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            ) : null}
            <input
              placeholder="To"
              value={compose.to}
              onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
              style={{ display: "block", width: "100%", marginBottom: 8, padding: 8, fontSize: 13, border: "1px solid #ddd", borderRadius: 4 }}
            />
            <input
              placeholder="Subject"
              value={compose.subject}
              onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
              style={{ display: "block", width: "100%", marginBottom: 8, padding: 8, fontSize: 13, border: "1px solid #ddd", borderRadius: 4 }}
            />
            <textarea
              placeholder="Write your message..."
              value={compose.body}
              onChange={(e) => setCompose((c) => ({ ...c, body: e.target.value }))}
              rows={10}
              style={{ display: "block", width: "100%", marginBottom: 8, padding: 8, fontSize: 13, border: "1px solid #ddd", borderRadius: 4, resize: "vertical" }}
            />
            {error ? <div style={{ color: "#c23934", fontSize: 12, marginBottom: 8 }}>{error}</div> : null}
            <button
              onClick={() => void sendNew()}
              disabled={sending || !compose.to.trim()}
              style={{ padding: "7px 18px", background: "#0176d3", color: "#fff", border: 0, borderRadius: 4, fontSize: 13, cursor: "pointer", opacity: sending ? 0.6 : 1 }}
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        ) : !selected ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#706e6b", fontSize: 13 }}>
            Select a conversation
          </div>
        ) : (
          <>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #e5e5e5", background: "#fff" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{selected.subject}</div>
              <div style={{ fontSize: 12, color: "#706e6b", display: "flex", gap: 12, marginTop: 2 }}>
                {selected.leadId ? (
                  <Link href={`/leads/${selected.leadId}`} style={{ color: "#0176d3" }}>
                    Lead: {selected.leadName ?? "view"}
                  </Link>
                ) : null}
                {selected.accountId ? (
                  <Link href={`/accounts/${selected.accountId}`} style={{ color: "#0176d3" }}>
                    Account: {selected.accountName ?? "view"}
                  </Link>
                ) : null}
                {selected.contactId ? (
                  <Link href={`/contacts/${selected.contactId}`} style={{ color: "#0176d3" }}>
                    Contact: {selected.contactName ?? "view"}
                  </Link>
                ) : null}
                {isAdmin && selected.ownerName ? <span>Owner: {selected.ownerName}</span> : null}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: m.direction === "OUTBOUND" ? "#eef4fb" : "#fff",
                    border: "1px solid #e5e5e5",
                    borderRadius: 8,
                    padding: 14,
                    marginBottom: 12,
                    maxWidth: 720,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#706e6b", marginBottom: 8 }}>
                    <span>
                      <b style={{ color: "#181818" }}>{m.fromAddress}</b> to {m.toAddresses}
                    </span>
                    <span>
                      {new Date(m.createdAt).toLocaleString()}
                      {m.direction === "OUTBOUND" ? ` · ${m.status.toLowerCase()}` : ""}
                    </span>
                  </div>
                  {m.bodyHtml ? (
                    <div style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: m.bodyHtml }} />
                  ) : (
                    <pre style={{ fontSize: 13, whiteSpace: "pre-wrap", fontFamily: FONT, margin: 0 }}>{m.bodyText}</pre>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e5e5", background: "#fff" }}>
              <textarea
                placeholder="Reply..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                style={{ display: "block", width: "100%", padding: 8, fontSize: 13, border: "1px solid #ddd", borderRadius: 4, resize: "vertical", marginBottom: 8 }}
              />
              {error ? <div style={{ color: "#c23934", fontSize: 12, marginBottom: 8 }}>{error}</div> : null}
              <button
                onClick={() => void sendReply()}
                disabled={sending || !reply.trim()}
                style={{ padding: "6px 16px", background: "#0176d3", color: "#fff", border: 0, borderRadius: 4, fontSize: 13, cursor: "pointer", opacity: sending ? 0.6 : 1 }}
              >
                {sending ? "Sending..." : "Reply"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

Note: `openThread` loads thread messages via the existing `/api/emails?limit=200` list and filters client-side by threadId. `/api/emails` GET does not return `threadId` today; add `threadId` to its response by extending the query in `src/app/api/emails/route.ts` GET with an explicit include already returning full rows (it uses `findMany` without `select`, so `threadId` is included automatically once the schema has it). Verify in the browser network tab that `threadId` appears; if the route uses a `select`, add `threadId: true`.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open `/email-center`:
1. Inbox lists your INBOUND threads (legacy rows show as single-message threads), Sent lists OUTBOUND.
2. Send a new email from New Email; it appears under Sent.
3. Reply in a thread; the reply appears in the conversation.
4. As an admin, switch Viewing to another user and to All users.
5. Unread badge decrements after opening an unread thread.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/email-center "src/app/(dashboard)/email-center" src/app/api/emails/route.ts
git commit -m "Email Center inbox: per-user threads, unread state, reply, admin switcher"
```

---

### Task 8: Backfill threads for existing messages

**Files:**
- Create: `scripts/backfill-email-threads.ts`

- [ ] **Step 1: Write the backfill script**

```typescript
// scripts/backfill-email-threads.ts
/**
 * One-time backfill: set subjectNorm + threadId on existing EmailMessage rows.
 * Walks messages oldest-first so replies attach to already-threaded parents.
 *
 * Run locally: npx tsx scripts/backfill-email-threads.ts
 * Run on prod data: DATABASE_URL=<prod url> npx tsx scripts/backfill-email-threads.ts
 */
import { prisma } from "../src/lib/prisma";
import {
  extractEmails,
  normalizeSubject,
  prismaThreadFinders,
  resolveThreadId,
} from "../src/lib/email/threading";

async function main() {
  const finders = prismaThreadFinders();
  let processed = 0;
  for (;;) {
    const batch = await prisma.emailMessage.findMany({
      where: { threadId: null },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true, direction: true, subject: true, fromAddress: true,
        toAddresses: true, inReplyTo: true, createdAt: true,
      },
    });
    if (batch.length === 0) break;
    for (const m of batch) {
      const counterparty =
        m.direction === "INBOUND" ? extractEmails(m.fromAddress) : extractEmails(m.toAddresses);
      const threadId =
        (await resolveThreadId(
          { inReplyTo: m.inReplyTo, subject: m.subject, counterpartyEmails: counterparty },
          finders,
          m.createdAt,
        )) ?? m.id;
      await prisma.emailMessage.update({
        where: { id: m.id },
        data: { threadId, subjectNorm: normalizeSubject(m.subject) },
      });
      processed += 1;
    }
    console.log(`threaded ${processed} messages...`);
  }
  console.log(`Done. ${processed} messages threaded.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run locally and verify**

Run: `npx tsx scripts/backfill-email-threads.ts`
Expected: "Done. N messages threaded." Then verify no orphans:
`npx tsx -e "import {prisma} from './src/lib/prisma'; prisma.emailMessage.count({where:{threadId:null}}).then(c=>{console.log('unthreaded:',c);return prisma.\$disconnect()})"`
Expected: `unthreaded: 0`.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-email-threads.ts
git commit -m "Backfill script: thread existing email messages"
```

---

### Task 9: Full verification pass

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: all tests PASS (new threading tests plus the existing suite).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors in the files this plan touched.

- [ ] **Step 4: Re-run the Task 7 manual checklist once more against the dev server**

- [ ] **Step 5: Final commit if anything changed, then report**

Do NOT push to main yet. Deploy (push to main) only when Bar says to, and remember the schema change: prod needs `npx prisma db push` semantics via the Railway build plus the thread backfill run against the prod DATABASE_URL.

---

## Post-deploy ops checklist (manual, with Bar)

1. Verify the `coastaldebt.com` domain in Resend (sending) if not already done, and confirm DKIM/SPF records.
2. Resend Inbound: create/confirm the catch-all route to `https://crm-production-613a.up.railway.app/api/emails/webhook/inbound` (or the custom domain) and set `RESEND_WEBHOOK_SECRET` on Railway.
3. WARNING: pointing MX records for `coastaldebt.com` at Resend affects ALL company mail. If the company uses Google Workspace / Office 365 on this domain, do NOT change the root MX; instead pick a dedicated inbound subdomain (e.g. `crm.coastaldebt.com`) for mailbox addresses, which only changes that subdomain's MX. Confirm with Bar before any DNS change.
4. Provision `mailboxAddress` for each agent in Settings > Users.
5. Run `scripts/backfill-email-threads.ts` against the prod DATABASE_URL.
6. Send a test email to a provisioned address and confirm it lands in that agent's Email Center inbox and threads correctly on reply.
