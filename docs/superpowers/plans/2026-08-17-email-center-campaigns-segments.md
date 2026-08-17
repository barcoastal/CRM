# Email Center Phase 1b: Campaigns + Segments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Klaviyo-style campaigns (multi-source audiences, scheduling, throttling, unsubscribe compliance) and reusable filter-based Segments inside the Email Center, built on the existing MassEmail pipeline.

**Architecture:** Extend, never fork: `MassEmail` + `src/lib/email/mass-sender.ts` stay the engine. New `Segment` model shares the `ListFilter[]` + `buildWhere` translator that ListViews already use (`src/lib/list-views.ts`). Audiences become a union of sources (segments, list views, dialer campaign members) deduped by email. Suppression uses the Phase 1c `EmailSuppression` model; unsubscribe links + List-Unsubscribe headers write to it. Scheduling reuses `MassEmail.scheduledAt` with a cron-called processor following the `/api/flow/poll` bearer-auth pattern.

**Tech Stack:** Next.js App Router, Prisma/Postgres (`prisma db push`), Resend, vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-email-center-design.md` sections 2 (Campaigns) and 3 (Segments). Deliberately EXCLUDED (do not flag): per-campaign drill-down beyond basic counts (full Reports are 1c part 2), segment-entry flow triggers (small follow-up after this ships), campaign A/B testing.

**Codebase facts the engineer needs:**
- `model MassEmail` (schema ~line 2000): audienceType "filter"|"list", audienceFilter Json, audienceIds String[], totalCount/sentCount/failedCount/openCount/clickCount, status DRAFT|SENDING|SENT|FAILED, scheduledAt, fromUserId, templateId, messages relation.
- `src/lib/email/mass-sender.ts` (437 lines): `resolveAudience(audienceType, audienceFilter, audienceIds)`, `countAudience(...)`, `instrumentBody(...)` (merge + click rewrite + pixel), `runWithConcurrency`, `startMassEmailJob(massEmailId)` which resolves recipients, sets SENDING + totalCount, sends via a local `sendViaResend`, creates one EmailMessage per recipient (with trackingId, massEmailId, SENT/FAILED status), then sets SENT + counts and notifies the creator. DEFAULT_CONCURRENCY = 5.
- `Recipient` interface in mass-sender: { entityType "Lead"|"Contact", id, email, vars, leadId?, contactId?, accountId? }. Loaders: `loadLeadsAsRecipients(ids)`, `loadContactsAsRecipients(ids)`.
- `src/lib/list-views.ts`: `ListFilter { field, op, value }`, `FilterOp` (EQ/NEQ/CONTAINS/NOT_CONTAINS/STARTS_WITH/IN/NOT_IN/GT/GTE/LT/LTE/IS_NULL/IS_NOT_NULL/OR), pure `buildWhere(filters)` producing a Prisma where subtree. `model ListView` has entity, name, filters Json (ListFilter[]).
- `model Campaign`/`CampaignContact` (schema ~line 926): dialer campaigns; CampaignContact links campaignId + leadId.
- `EmailSuppression` model + `src/lib/email/suppression.ts` (`isEmailSuppressed`, `addEmailSuppression`, `normalizeEmail`) exist from the Flows build.
- Threading: `normalizeSubject` in `src/lib/email/threading.ts`; EmailMessage has subjectNorm/threadId (self-anchor convention: threadId = own id for new outbound threads).
- Tracking: `src/lib/email/tracking-rewrite.ts` exports `getTrackingBaseUrl()`; pixel/click routes under `src/app/api/emails/track/`.
- Mass APIs: `src/app/api/emails/mass/route.ts` (GET list, POST create draft), plus `mass/[id]`, `mass/[id]/send`, `mass/[id]/preview`, `mass/audience-count` (read each before editing).
- Cron auth pattern (copy exactly): see `src/app/api/flow/sweep/route.ts` `authorize()` (Bearer FLOW_POLL_SECRET, fallback PROCESSOR_SYNC_SECRET).
- Email Center UI: `.ec-` classes in `src/app/(dashboard)/email-center/email-center.css` (monochrome: black rail, white cards, lime `--ec-lime`, `.ec-btn-primary`, `.ec-pill*`, `.ec-flows-*` list patterns worth copying, `.ec-switch`). Placeholders to replace: `email-center/campaigns/page.tsx`, `email-center/segments/page.tsx`. Rail: `email-center/tab-rail.tsx` (Campaigns and Segments entries carry `soon: "1b"` to remove).
- User admin/auth: `requireAuthOrRespond("Email.Send")` returns `r.session.userId` / `r.session.role`; ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"].
- Local DB: `postgresql://postgres:postgres@localhost:5432/crm_local` (repo .env is stale sqlite; always override). No em dashes anywhere. Never push to the remote.

---

### Task 1: Schema (Segment model + MassEmail campaign fields)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Segment model**

Add near `model ListView` (~line 2229):

```prisma
// Saved audience segment for Email Center campaigns. filters use the same
// ListFilter[] shape as ListView.filters and translate to Prisma where
// clauses via src/lib/list-views.ts buildWhere.
model Segment {
  id          String   @id @default(cuid())
  name        String
  description String?
  entity      String // "Lead" | "Contact"
  filters     Json     @default("[]") // ListFilter[]
  createdById String?
  createdBy   User?    @relation("SegmentCreatedBy", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([entity])
}
```

Add to `model User` relations (near the other named relations): `segmentsCreated Segment[] @relation("SegmentCreatedBy")`.

- [ ] **Step 2: MassEmail campaign fields**

In `model MassEmail`, after `audienceIds`, add:

```prisma
  // Multi-source audiences (Email Center campaigns). When audienceType is
  // "sources", this holds [{ type: "segment" | "listview" | "campaign", id }]
  // resolved as a union deduped by email at send time.
  audienceSources   Json @default("[]")
  // Sends per minute cap. Null = full speed (DEFAULT_CONCURRENCY workers).
  throttlePerMinute Int?
  suppressedCount   Int  @default(0)
```

Update the status comment to `// DRAFT | SCHEDULED | SENDING | SENT | FAILED | CANCELED`.

- [ ] **Step 3: Push + generate + commit**

Run: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_local" npx prisma db push --accept-data-loss && npx prisma generate && npx prisma validate`

```bash
git add prisma/schema.prisma
git commit -m "Campaigns + Segments schema: Segment model, multi-source audiences, throttle"
```

---

### Task 2: Multi-source audience resolver (TDD)

**Files:**
- Create: `src/lib/email/audience.ts`
- Modify: `src/lib/email/mass-sender.ts` (resolveAudience/countAudience only)
- Test: `tests/email-audience.test.ts`

- [ ] **Step 1: failing tests for the pure parts**

```typescript
// tests/email-audience.test.ts
import { describe, it, expect } from "vitest";
import { dedupeByEmail, parseSources, type AudienceSource } from "@/lib/email/audience";

describe("parseSources", () => {
  it("keeps only well-formed sources", () => {
    const raw = [
      { type: "segment", id: "s1" },
      { type: "listview", id: "l1" },
      { type: "campaign", id: "c1" },
      { type: "bogus", id: "x" },
      { type: "segment" },
      "junk",
    ];
    expect(parseSources(raw)).toEqual([
      { type: "segment", id: "s1" },
      { type: "listview", id: "l1" },
      { type: "campaign", id: "c1" },
    ]);
  });
  it("handles non-arrays", () => {
    expect(parseSources(null)).toEqual([]);
    expect(parseSources({})).toEqual([]);
  });
});

describe("dedupeByEmail", () => {
  const r = (email: string, id: string) => ({
    entityType: "Lead" as const,
    id,
    email,
    vars: {},
  });
  it("keeps the first recipient per case-insensitive email", () => {
    const out = dedupeByEmail([r("A@x.com", "1"), r("a@x.com", "2"), r("b@x.com", "3")]);
    expect(out.map((x) => x.id)).toEqual(["1", "3"]);
  });
  it("drops empty emails", () => {
    expect(dedupeByEmail([r("", "1")])).toEqual([]);
  });
});
```

- [ ] **Step 2: run, verify FAIL (module not found)**

Run: `npx vitest run tests/email-audience.test.ts`

- [ ] **Step 3: implement the resolver**

```typescript
// src/lib/email/audience.ts
/**
 * Multi-source campaign audiences. A campaign's audience is a union of
 * sources (saved Segments, ListViews, dialer Campaign members) resolved to
 * Recipient rows and deduped by email (first source wins).
 */
import { prisma } from "@/lib/prisma";
import { buildWhere, type ListFilter } from "@/lib/list-views";

export interface AudienceSource {
  type: "segment" | "listview" | "campaign";
  id: string;
}

/** Minimal recipient shape shared with mass-sender (structurally compatible). */
export interface AudienceRecipient {
  entityType: "Lead" | "Contact";
  id: string;
  email: string;
  vars: Record<string, string | number | null>;
  leadId?: string;
  contactId?: string;
  accountId?: string;
}

const SOURCE_TYPES = new Set(["segment", "listview", "campaign"]);

export function parseSources(raw: unknown): AudienceSource[] {
  if (!Array.isArray(raw)) return [];
  const out: AudienceSource[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      SOURCE_TYPES.has(String((item as { type?: unknown }).type)) &&
      typeof (item as { id?: unknown }).id === "string" &&
      (item as { id: string }).id
    ) {
      out.push({ type: (item as { type: AudienceSource["type"] }).type, id: (item as { id: string }).id });
    }
  }
  return out;
}

export function dedupeByEmail<T extends { email: string }>(recipients: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of recipients) {
    const key = r.email.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

type IdLoader = {
  leads: (ids: string[]) => Promise<AudienceRecipient[]>;
  contacts: (ids: string[]) => Promise<AudienceRecipient[]>;
};

/** Resolve one source to entity ids grouped by entity type. */
async function sourceIds(source: AudienceSource): Promise<{ entity: "Lead" | "Contact"; ids: string[] } | null> {
  if (source.type === "segment") {
    const seg = await prisma.segment.findUnique({ where: { id: source.id } });
    if (!seg) return null;
    const entity = seg.entity === "Contact" ? "Contact" : "Lead";
    const where = { email: { not: null }, ...buildWhere((seg.filters as unknown as ListFilter[]) ?? []) };
    const delegate = entity === "Lead" ? prisma.lead : prisma.contact;
    const rows = await (delegate as unknown as { findMany: (a: object) => Promise<Array<{ id: string }>> }).findMany({
      where,
      select: { id: true },
      take: 10000,
    });
    return { entity, ids: rows.map((r) => r.id) };
  }
  if (source.type === "listview") {
    const view = await prisma.listView.findUnique({ where: { id: source.id } });
    if (!view) return null;
    const entity = view.entity === "Contact" ? "Contact" : view.entity === "Lead" ? "Lead" : null;
    if (!entity) return null; // campaigns only mail leads/contacts
    const where = { email: { not: null }, ...buildWhere((view.filters as unknown as ListFilter[]) ?? []) };
    const delegate = entity === "Lead" ? prisma.lead : prisma.contact;
    const rows = await (delegate as unknown as { findMany: (a: object) => Promise<Array<{ id: string }>> }).findMany({
      where,
      select: { id: true },
      take: 10000,
    });
    return { entity, ids: rows.map((r) => r.id) };
  }
  // dialer campaign members are leads
  const members = await prisma.campaignContact.findMany({
    where: { campaignId: source.id },
    select: { leadId: true },
  });
  return { entity: "Lead", ids: members.map((m) => m.leadId) };
}

/**
 * Resolve all sources to full recipients, deduped by email. Loaders are
 * injected by mass-sender so its Recipient var-building stays in one place.
 */
export async function resolveSourcesAudience(
  rawSources: unknown,
  load: IdLoader,
): Promise<AudienceRecipient[]> {
  const sources = parseSources(rawSources);
  const all: AudienceRecipient[] = [];
  for (const source of sources) {
    const resolved = await sourceIds(source);
    if (!resolved || resolved.ids.length === 0) continue;
    const recipients =
      resolved.entity === "Lead" ? await load.leads(resolved.ids) : await load.contacts(resolved.ids);
    all.push(...recipients);
  }
  return dedupeByEmail(all);
}

/** Count preview for the campaign builder: resolves ids only, dedupe not applied (fast). */
export async function countSourcesAudience(rawSources: unknown): Promise<{ total: number; perSource: Array<{ type: string; id: string; count: number }> }> {
  const sources = parseSources(rawSources);
  const perSource: Array<{ type: string; id: string; count: number }> = [];
  let total = 0;
  for (const source of sources) {
    const resolved = await sourceIds(source);
    const count = resolved?.ids.length ?? 0;
    perSource.push({ type: source.type, id: source.id, count });
    total += count;
  }
  return { total, perSource };
}
```

- [ ] **Step 4: run tests, PASS; full suite green.**

- [ ] **Step 5: wire into mass-sender**

In `src/lib/email/mass-sender.ts`:

a) Add import:
```typescript
import { resolveSourcesAudience, countSourcesAudience } from "@/lib/email/audience";
```

b) `resolveAudience` gains a fourth parameter and a sources branch. Replace the function with:

```typescript
export async function resolveAudience(
  audienceType: string,
  audienceFilter: AudienceFilter,
  audienceIds: string[],
  audienceSources: unknown = [],
): Promise<Recipient[]> {
  if (audienceType === "sources") {
    return resolveSourcesAudience(audienceSources, {
      leads: loadLeadsAsRecipients,
      contacts: loadContactsAsRecipients,
    }) as Promise<Recipient[]>;
  }
  if (audienceType === "list") {
    const entityType = audienceFilter.entityType ?? "Lead";
    if (entityType === "Lead") return loadLeadsAsRecipients(audienceIds);
    return loadContactsAsRecipients(audienceIds);
  }
  return resolveRecipientsByFilter(audienceFilter);
}
```

c) `countAudience` gains the same fourth parameter; at its top add:

```typescript
  if (audienceType === "sources") {
    const { total } = await countSourcesAudience(audienceSources);
    return total;
  }
```

(change its signature to `countAudience(audienceType, audienceFilter, audienceIds, audienceSources: unknown = [])`).

d) In `startMassEmailJob`, change the resolveAudience call to pass `mass.audienceSources`:

```typescript
    const recipients = await resolveAudience(mass.audienceType, audienceFilter, mass.audienceIds, mass.audienceSources);
```

e) Find all existing callers of `countAudience` (grep; `src/app/api/emails/mass/audience-count/route.ts` at least) and pass the new argument where available.

- [ ] **Step 6: verify + commit**

`npx tsc --noEmit 2>&1 | grep -iE "audience|mass-sender" || echo CLEAN`, `npx vitest run` green.

```bash
git add src/lib/email/audience.ts tests/email-audience.test.ts src/lib/email/mass-sender.ts src/app/api/emails/mass
git commit -m "Campaign audiences: multi-source resolver (segments, list views, dialer campaigns)"
```

---

### Task 3: Suppression, unsubscribe compliance, threading on mass sends

**Files:**
- Modify: `src/lib/email/mass-sender.ts`
- Create: `src/app/api/emails/unsubscribe/[trackingId]/route.ts`
- Test: `tests/mass-compliance.test.ts`

- [ ] **Step 1: failing tests for the pure footer/header helpers**

```typescript
// tests/mass-compliance.test.ts
import { describe, it, expect } from "vitest";
import { appendUnsubscribeFooter, unsubscribeHeaders } from "@/lib/email/mass-sender";

describe("appendUnsubscribeFooter", () => {
  it("appends a footer link before </body> when present", () => {
    const out = appendUnsubscribeFooter("<html><body><p>Hi</p></body></html>", "https://x.com/u/t1");
    expect(out).toContain('href="https://x.com/u/t1"');
    expect(out.indexOf("Unsubscribe")).toBeLessThan(out.indexOf("</body>"));
  });
  it("appends at the end when no body tag", () => {
    const out = appendUnsubscribeFooter("<p>Hi</p>", "https://x.com/u/t1");
    expect(out.endsWith("</p>")).toBe(false);
    expect(out).toContain("Unsubscribe");
  });
});

describe("unsubscribeHeaders", () => {
  it("builds one-click List-Unsubscribe headers", () => {
    const h = unsubscribeHeaders("https://x.com/u/t1");
    expect(h["List-Unsubscribe"]).toBe("<https://x.com/u/t1>");
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});
```

- [ ] **Step 2: run, FAIL (exports missing).**

- [ ] **Step 3: implement in mass-sender.ts**

Add exports (near `instrumentBody`):

```typescript
/** Campaign footer: a plain unsubscribe link appended to the rendered HTML. */
export function appendUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  const footer = `<p style="font-size:11px;color:#9c9c97;margin-top:24px">You are receiving this email from Coastal Debt. <a href="${unsubscribeUrl}" style="color:#9c9c97">Unsubscribe</a></p>`;
  if (html.includes("</body>")) return html.replace("</body>", `${footer}</body>`);
  return html + footer;
}

/** RFC 8058 one-click unsubscribe headers. */
export function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
```

- [ ] **Step 4: tests pass.**

- [ ] **Step 5: apply compliance + threading inside startMassEmailJob**

All edits inside `src/lib/email/mass-sender.ts`:

a) Imports:
```typescript
import { normalizeSubject } from "@/lib/email/threading";
import { normalizeEmail } from "@/lib/email/suppression";
```

b) The local `sendViaResend` gains a `headers` arg: add `headers?: Record<string, string> | null;` to its args type and in the body construction `if (args.headers && Object.keys(args.headers).length > 0) body.headers = args.headers;`.

c) From address prefers the mailbox. Replace the `fromAddress` computation with:

```typescript
    const fromUserRow = mass.fromUserId
      ? await prisma.user.findUnique({
          where: { id: mass.fromUserId },
          select: { name: true, email: true, mailboxAddress: true },
        })
      : null;
    const senderAddr = fromUserRow?.mailboxAddress ?? fromUserRow?.email ?? null;
    const fromAddress = senderAddr
      ? `"${(fromUserRow?.name ?? senderAddr).replace(/"/g, '\\"')}" <${senderAddr}>`
      : defaultFrom;
```

(and change the earlier `fromUser` include to keep working, or drop the include if now unused).

d) Suppression pre-filter, right after `resolveAudience`:

```typescript
    // Drop suppressed addresses in one query; count them for the report.
    const emails = recipients.map((r) => normalizeEmail(r.email)).filter(Boolean);
    const suppressedRows = emails.length
      ? await prisma.emailSuppression.findMany({
          where: { email: { in: emails } },
          select: { email: true },
        })
      : [];
    const suppressedSet = new Set(suppressedRows.map((s) => s.email));
    const sendable = recipients.filter((r) => !suppressedSet.has(normalizeEmail(r.email)));
    const suppressed = recipients.length - sendable.length;
```

Then use `sendable` (not `recipients`) in the SENDING update (`totalCount: sendable.length, suppressedCount: suppressed`) and in the send loop.

Immediately after computing `sendable`, block empty blasts (spec: never silently send to nobody):

```typescript
    if (sendable.length === 0) {
      await prisma.massEmail.update({
        where: { id: massEmailId },
        data: { status: "FAILED", suppressedCount: suppressed },
      });
      return { ok: false, error: suppressed > 0 ? "All recipients are suppressed" : "Audience resolved to zero recipients" };
    }
```

The wizard already surfaces the send route's error body, so the user sees this message directly.

e) Per-recipient, in the worker after `instrumentBody`:

```typescript
        const unsubscribeUrl = `${baseUrl}/api/emails/unsubscribe/${trackingId}`;
        if (rendered.html) rendered.html = appendUnsubscribeFooter(rendered.html, unsubscribeUrl);
```

and pass to sendViaResend: `headers: unsubscribeHeaders(unsubscribeUrl),`.

f) Threading fields on the per-send EmailMessage create (the success-path one AND the catch-path one): add

```typescript
            subjectNorm: normalizeSubject(rendered.subject),
```

to the success-path create (catch path uses `normalizeSubject(mass.template!.subject)`), and after each create self-anchor the thread:

```typescript
        // then, with the created row in a variable:
        await prisma.emailMessage.update({ where: { id: created.id }, data: { threadId: created.id } });
```

(assign the create result to `created` with `select: { id: true }`; in the catch path wrap the update in try/catch like the create).

- [ ] **Step 6: unsubscribe endpoint**

```typescript
// src/app/api/emails/unsubscribe/[trackingId]/route.ts
/**
 * Unsubscribe landing. The tracking id maps to the exact EmailMessage that
 * carried the link, so we know the recipient address without a signed token.
 * GET renders a tiny confirmation page and suppresses; POST supports RFC 8058
 * one-click (mail clients POST with no body).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addEmailSuppression } from "@/lib/email/suppression";
import { extractEmails } from "@/lib/email/threading";

async function suppressByTrackingId(trackingId: string): Promise<string | null> {
  const msg = await prisma.emailMessage.findUnique({
    where: { trackingId },
    select: { toAddresses: true },
  });
  if (!msg) return null;
  const email = extractEmails(msg.toAddresses)[0] ?? null;
  if (!email) return null;
  await addEmailSuppression(email, "UNSUBSCRIBE", "unsubscribe-link");
  return email;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await ctx.params;
  const email = await suppressByTrackingId(trackingId);
  const message = email
    ? `${email} has been unsubscribed. You will not receive marketing email from us again.`
    : "This unsubscribe link is invalid or expired.";
  return new NextResponse(
    `<!doctype html><html><head><title>Unsubscribe</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f7f7f6"><div style="max-width:420px;background:#fff;border:1px solid #e6e6e3;border-radius:14px;padding:32px;text-align:center"><h1 style="font-size:18px;margin:0 0 8px">Coastal Debt</h1><p style="font-size:14px;color:#444">${message}</p></div></body></html>`,
    { status: email ? 200 : 404, headers: { "Content-Type": "text/html" } },
  );
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ trackingId: string }> }) {
  const { trackingId } = await ctx.params;
  const email = await suppressByTrackingId(trackingId);
  return NextResponse.json({ ok: Boolean(email) }, { status: email ? 200 : 404 });
}
```

- [ ] **Step 7: verify + commit**

`npx tsc --noEmit 2>&1 | grep -iE "mass-sender|unsubscribe" || echo CLEAN`; `npx vitest run` green.

```bash
git add src/lib/email/mass-sender.ts src/app/api/emails/unsubscribe tests/mass-compliance.test.ts
git commit -m "Campaign compliance: suppression pre-filter, unsubscribe link + one-click headers, threading"
```

---

### Task 4: Scheduling, throttle, cancel

**Files:**
- Modify: `src/lib/email/mass-sender.ts` (throttle + status guard)
- Modify: `src/app/api/emails/mass/route.ts` and `src/app/api/emails/mass/[id]/send/route.ts` (read both first)
- Create: `src/app/api/emails/mass/process-scheduled/route.ts`
- Create: `src/app/api/emails/mass/[id]/cancel/route.ts`

- [ ] **Step 1: throttle in the send loop**

In `startMassEmailJob`: read `mass.throttlePerMinute`. Where the concurrency is chosen, use:

```typescript
    const throttle = mass.throttlePerMinute && mass.throttlePerMinute > 0 ? mass.throttlePerMinute : null;
    const concurrency = throttle ? 1 : DEFAULT_CONCURRENCY;
    const delayMs = throttle ? Math.ceil(60000 / throttle) : 0;
```

Pass `concurrency` to `runWithConcurrency`, and at the top of the worker add:

```typescript
      if (delayMs > 0) await new Promise((res) => setTimeout(res, delayMs));
```

b) Cancel guard: at the start of `startMassEmailJob` after loading `mass`, add:

```typescript
    if (mass.status === "CANCELED") return { ok: false, error: "Campaign canceled" };
    if (mass.status === "SENDING" || mass.status === "SENT") return { ok: false, error: `Already ${mass.status.toLowerCase()}` };
```

- [ ] **Step 2: schedule-aware send route**

Read `src/app/api/emails/mass/[id]/send/route.ts`. Change its behavior: accept optional body `{ scheduledAt?: string }`. If `scheduledAt` parses to a FUTURE date: update the MassEmail to `{ status: "SCHEDULED", scheduledAt }` and return `{ ok: true, scheduled: true }` WITHOUT sending. Otherwise keep the current immediate-send behavior (which calls `startMassEmailJob`). Also reject sending when current status is not DRAFT or SCHEDULED (409).

- [ ] **Step 3: creation route accepts campaign fields**

In `src/app/api/emails/mass/route.ts` POST: extend the accepted body with `audienceSources?: unknown[]`, `throttlePerMinute?: number`, and allow `audienceType: "sources"`. Persist them (`audienceSources: body.audienceSources ?? []`, `throttlePerMinute` clamped 1..600 or null). Keep existing behavior for the old audience types.

Also extend `src/app/api/emails/mass/audience-count/route.ts` to accept and forward `audienceSources` to `countAudience`.

- [ ] **Step 4: scheduled processor cron**

```typescript
// src/app/api/emails/mass/process-scheduled/route.ts
/**
 * Starts campaigns whose scheduledAt has passed. Call every minute from the
 * external cron alongside /api/flow/poll.
 *
 *   POST /api/emails/mass/process-scheduled
 *   Authorization: Bearer ${FLOW_POLL_SECRET} (or PROCESSOR_SYNC_SECRET)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startMassEmailJob } from "@/lib/email/mass-sender";

function authorize(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  const primary = process.env.FLOW_POLL_SECRET;
  const fallback = process.env.PROCESSOR_SYNC_SECRET;
  if (!primary && !fallback) return false;
  if (primary && token === primary) return true;
  if (fallback && token === fallback) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const due = await prisma.massEmail.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    select: { id: true },
    take: 10,
    orderBy: { scheduledAt: "asc" },
  });
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const m of due) {
    const r = await startMassEmailJob(m.id);
    results.push({ id: m.id, ok: r.ok, error: r.error });
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}
```

- [ ] **Step 5: cancel route**

```typescript
// src/app/api/emails/mass/[id]/cancel/route.ts
/** POST: cancel a DRAFT or SCHEDULED campaign. Sending/sent blasts cannot be canceled. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const mass = await prisma.massEmail.findUnique({ where: { id }, select: { status: true } });
  if (!mass) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (mass.status !== "DRAFT" && mass.status !== "SCHEDULED") {
    return NextResponse.json({ error: `Cannot cancel a ${mass.status.toLowerCase()} campaign` }, { status: 409 });
  }
  await prisma.massEmail.update({ where: { id }, data: { status: "CANCELED" } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: verify + commit**

`npx tsc --noEmit 2>&1 | grep -iE "emails/mass|mass-sender" || echo CLEAN`; `npx vitest run` green.

```bash
git add src/lib/email/mass-sender.ts src/app/api/emails/mass
git commit -m "Campaigns: scheduling with cron processor, throttle, cancel"
```

---

### Task 5: Segments API + builder UI

**Files:**
- Create: `src/app/api/email-center/segments/route.ts` (GET list, POST create)
- Create: `src/app/api/email-center/segments/[id]/route.ts` (GET, PATCH, DELETE)
- Create: `src/app/api/email-center/segments/count/route.ts` (POST live count)
- Replace: `src/app/(dashboard)/email-center/segments/page.tsx`
- Create: `src/app/(dashboard)/email-center/segments/segments-client.tsx`
- Modify: `src/app/(dashboard)/email-center/email-center.css` (append), `src/app/(dashboard)/email-center/tab-rail.tsx` (drop Segments soon pill)

- [ ] **Step 1: segments collection API**

```typescript
// src/app/api/email-center/segments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET() {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const items = await prisma.segment.findMany({
    orderBy: { updatedAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    entity?: string;
    filters?: unknown;
  };
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const entity = body.entity === "Contact" ? "Contact" : "Lead";
  const seg = await prisma.segment.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      entity,
      filters: (Array.isArray(body.filters) ? body.filters : []) as never,
      createdById: r.session.userId,
    },
  });
  return NextResponse.json(seg, { status: 201 });
}
```

- [ ] **Step 2: segment item API**

```typescript
// src/app/api/email-center/segments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const seg = await prisma.segment.findUnique({ where: { id } });
  if (!seg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(seg);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
    entity?: string;
    filters?: unknown;
  };
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (body.entity !== undefined) data.entity = body.entity === "Contact" ? "Contact" : "Lead";
  if (body.filters !== undefined) data.filters = Array.isArray(body.filters) ? body.filters : [];
  const seg = await prisma.segment.update({ where: { id }, data: data as never }).catch(() => null);
  if (!seg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(seg);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const seg = await prisma.segment.delete({ where: { id } }).catch(() => null);
  if (!seg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: live count API**

```typescript
// src/app/api/email-center/segments/count/route.ts
/** POST { entity, filters } returns how many mailable records match. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { buildWhere, type ListFilter } from "@/lib/list-views";

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const body = (await req.json().catch(() => ({}))) as { entity?: string; filters?: unknown };
  const entity = body.entity === "Contact" ? "Contact" : "Lead";
  const filters = (Array.isArray(body.filters) ? body.filters : []) as ListFilter[];
  const where = { email: { not: null }, ...buildWhere(filters) };
  const count =
    entity === "Lead"
      ? await prisma.lead.count({ where: where as never })
      : await prisma.contact.count({ where: where as never });
  return NextResponse.json({ count });
}
```

- [ ] **Step 4: segments page + builder client**

`src/app/(dashboard)/email-center/segments/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { SegmentsClient } from "./segments-client";

export const dynamic = "force-dynamic";

export default async function EmailCenterSegmentsPage() {
  const segments = await prisma.segment.findMany({
    orderBy: { updatedAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  return (
    <SegmentsClient
      initial={segments.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        entity: s.entity,
        filters: (s.filters as Array<{ field: string; op: string; value?: unknown }>) ?? [],
        createdByName: s.createdBy?.name ?? null,
        updatedAt: s.updatedAt.toISOString(),
      }))}
    />
  );
}
```

`src/app/(dashboard)/email-center/segments/segments-client.tsx` (complete component):

```tsx
"use client";

/**
 * Segments tab: list of saved audience segments + inline builder.
 * Filters use the ListFilter { field, op, value } shape shared with list
 * views; the count preview hits /api/email-center/segments/count.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface Filter {
  field: string;
  op: string;
  value?: unknown;
}

interface SegmentRow {
  id: string;
  name: string;
  description: string | null;
  entity: string;
  filters: Filter[];
  createdByName: string | null;
  updatedAt: string;
}

const FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  Lead: [
    { key: "status", label: "Status" },
    { key: "source", label: "Source" },
    { key: "recordType", label: "Record Type" },
    { key: "state", label: "State" },
    { key: "assignedToId", label: "Owner Id" },
    { key: "totalDebtEst", label: "Est. Total Debt" },
  ],
  Contact: [
    { key: "isActive", label: "Active" },
    { key: "ownerId", label: "Owner Id" },
    { key: "mailingState", label: "Mailing State" },
  ],
};

const OPS = [
  { key: "EQ", label: "equals" },
  { key: "NEQ", label: "not equal" },
  { key: "CONTAINS", label: "contains" },
  { key: "IN", label: "is any of (comma list)" },
  { key: "GT", label: "greater than" },
  { key: "LT", label: "less than" },
  { key: "IS_NULL", label: "is empty" },
  { key: "IS_NOT_NULL", label: "is not empty" },
];

function coerceValue(op: string, raw: string): unknown {
  if (op === "IS_NULL" || op === "IS_NOT_NULL") return undefined;
  if (op === "IN") return raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw !== "" && !Number.isNaN(Number(raw)) && op !== "CONTAINS") return Number(raw);
  return raw;
}

function displayValue(f: Filter): string {
  if (Array.isArray(f.value)) return (f.value as unknown[]).join(", ");
  return f.value === undefined || f.value === null ? "" : String(f.value);
}

export function SegmentsClient({ initial }: { initial: SegmentRow[] }) {
  const [segments, setSegments] = useState(initial);
  const [editing, setEditing] = useState<SegmentRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCount = useCallback((entity: string, filters: Filter[]) => {
    if (countTimer.current) clearTimeout(countTimer.current);
    countTimer.current = setTimeout(async () => {
      const res = await fetch("/api/email-center/segments/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, filters }),
      });
      const data = await res.json().catch(() => ({}));
      setCount(typeof data.count === "number" ? data.count : null);
    }, 350);
  }, []);

  function openNew() {
    const seg: SegmentRow = {
      id: "", name: "", description: null, entity: "Lead", filters: [],
      createdByName: null, updatedAt: new Date().toISOString(),
    };
    setEditing(seg);
    setIsNew(true);
    setCount(null);
    refreshCount(seg.entity, seg.filters);
  }

  function patchEditing(patch: Partial<SegmentRow>) {
    setEditing((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      refreshCount(next.entity, next.filters);
      return next;
    });
  }

  async function save() {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      name: editing.name,
      description: editing.description,
      entity: editing.entity,
      filters: editing.filters,
    };
    const res = await fetch(
      isNew ? "/api/email-center/segments" : `/api/email-center/segments/${editing.id}`,
      {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    const row: SegmentRow = {
      id: data.id, name: data.name, description: data.description, entity: data.entity,
      filters: (data.filters as Filter[]) ?? [], createdByName: editing.createdByName,
      updatedAt: new Date().toISOString(),
    };
    setSegments((prev) => (isNew ? [row, ...prev] : prev.map((s) => (s.id === row.id ? row : s))));
    setEditing(null);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/email-center/segments/${id}`, { method: "DELETE" });
    if (res.ok) setSegments((prev) => prev.filter((s) => s.id !== id));
  }

  useEffect(() => () => { if (countTimer.current) clearTimeout(countTimer.current); }, []);

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Segments</h1>
          <p className="ec-flows-sub">Saved audiences for campaigns. Filters update live as data changes.</p>
        </div>
        <button className="ec-btn ec-btn-primary" onClick={openNew}>New Segment</button>
      </div>

      {editing ? (
        <div className="ec-seg-editor">
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="ec-field-label">Name</label>
              <input className="ec-input" value={editing.name} placeholder="High-debt web leads"
                onChange={(e) => patchEditing({ name: e.target.value })} />
            </div>
            <div style={{ width: 140 }}>
              <label className="ec-field-label">Entity</label>
              <select className="ec-select" value={editing.entity}
                onChange={(e) => patchEditing({ entity: e.target.value, filters: [] })}>
                <option value="Lead">Leads</option>
                <option value="Contact">Contacts</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="ec-field-label">Conditions (all must match)</label>
            {editing.filters.map((f, i) => (
              <div key={i} className="ec-seg-filter-row">
                <select className="ec-select" style={{ width: 170 }} value={f.field}
                  onChange={(e) => {
                    const filters = [...editing.filters];
                    filters[i] = { ...filters[i], field: e.target.value };
                    patchEditing({ filters });
                  }}>
                  {(FIELDS[editing.entity] ?? []).map((fl) => (
                    <option key={fl.key} value={fl.key}>{fl.label}</option>
                  ))}
                </select>
                <select className="ec-select" style={{ width: 180 }} value={f.op}
                  onChange={(e) => {
                    const filters = [...editing.filters];
                    filters[i] = { ...filters[i], op: e.target.value, value: undefined };
                    patchEditing({ filters });
                  }}>
                  {OPS.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
                {f.op !== "IS_NULL" && f.op !== "IS_NOT_NULL" ? (
                  <input className="ec-input" style={{ flex: 1 }} value={displayValue(f)} placeholder="Value"
                    onChange={(e) => {
                      const filters = [...editing.filters];
                      filters[i] = { ...filters[i], value: coerceValue(f.op, e.target.value) };
                      patchEditing({ filters });
                    }} />
                ) : <span style={{ flex: 1 }} />}
                <button className="ec-btn ec-btn-ghost" onClick={() => {
                  patchEditing({ filters: editing.filters.filter((_, j) => j !== i) });
                }}>Remove</button>
              </div>
            ))}
            <button className="ec-btn ec-btn-ghost" style={{ marginTop: 6 }} onClick={() => {
              const first = (FIELDS[editing.entity] ?? [])[0]?.key ?? "status";
              patchEditing({ filters: [...editing.filters, { field: first, op: "EQ", value: "" }] });
            }}>
              + Add condition
            </button>
          </div>
          {error ? <div className="ec-error" style={{ marginTop: 10 }}>{error}</div> : null}
          <div className="ec-seg-editor-foot">
            <span className="ec-pill ec-pill-green">
              {count === null ? "Counting..." : `${count.toLocaleString()} matching with email`}
            </span>
            <span style={{ flex: 1 }} />
            <button className="ec-btn ec-btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="ec-btn ec-btn-primary" disabled={saving || !editing.name.trim()} onClick={() => void save()}>
              {saving ? "Saving..." : "Save Segment"}
            </button>
          </div>
        </div>
      ) : null}

      {segments.length === 0 && !editing ? (
        <div className="ec-empty" style={{ paddingTop: 60 }}>
          <div className="ec-empty-title">No segments yet</div>
          <div className="ec-empty-sub">Segments are saved audience filters you can reuse across campaigns.</div>
        </div>
      ) : (
        <div className="ec-flows-list">
          {segments.map((s) => (
            <div key={s.id} className="ec-flow-row">
              <button className="ec-flow-main" style={{ background: "none", border: 0, cursor: "pointer", textAlign: "left", padding: 0, fontFamily: "inherit" }}
                onClick={() => { setEditing(s); setIsNew(false); setCount(null); refreshCount(s.entity, s.filters); }}>
                <span className="ec-flow-name">{s.name}</span>
                {s.description ? <span className="ec-flow-desc">{s.description}</span> : null}
              </button>
              <span className="ec-pill ec-pill-neutral">{s.entity}</span>
              <span className="ec-pill ec-pill-neutral">
                {s.filters.length} condition{s.filters.length === 1 ? "" : "s"}
              </span>
              <button className="ec-btn ec-btn-ghost" onClick={() => void remove(s.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: CSS + rail**

Append to email-center.css:

```css
/* ---------- Segments builder ---------- */

.ec-seg-editor {
  max-width: 920px;
  background: #ffffff;
  border: 1px solid var(--ec-border);
  border-radius: 14px;
  box-shadow: var(--ec-shadow-lift);
  padding: 20px;
  margin-bottom: 18px;
  animation: ec-fade-up 0.25s ease both;
}

.ec-seg-filter-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.ec-seg-editor-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--ec-border-soft);
}
```

In tab-rail.tsx remove `soon: "1b"` from the Segments entry only.

- [ ] **Step 6: verify + commit**

`npx tsc --noEmit 2>&1 | grep -iE "segments" || echo CLEAN`; dev-server compile check on /email-center/segments (307 is fine).

```bash
git add src/app/api/email-center/segments "src/app/(dashboard)/email-center"
git commit -m "Segments: model-backed CRUD, live-count builder, Email Center tab"
```

---

### Task 6: Campaigns UI (list + wizard + detail)

**Files:**
- Replace: `src/app/(dashboard)/email-center/campaigns/page.tsx`
- Create: `src/app/(dashboard)/email-center/campaigns/campaigns-client.tsx`
- Create: `src/app/(dashboard)/email-center/campaigns/new/page.tsx`
- Create: `src/app/(dashboard)/email-center/campaigns/new/wizard-client.tsx`
- Create: `src/app/(dashboard)/email-center/campaigns/[id]/page.tsx`
- Modify: `email-center.css` (append), `tab-rail.tsx` (drop Campaigns soon pill)

- [ ] **Step 1: campaigns list page**

```tsx
// src/app/(dashboard)/email-center/campaigns/page.tsx
import { prisma } from "@/lib/prisma";
import { CampaignsClient } from "./campaigns-client";

export const dynamic = "force-dynamic";

export default async function EmailCenterCampaignsPage() {
  const items = await prisma.massEmail.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      template: { select: { name: true } },
      fromUser: { select: { name: true } },
    },
  });
  return (
    <CampaignsClient
      campaigns={items.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        templateName: m.template?.name ?? null,
        fromName: m.fromUser?.name ?? null,
        totalCount: m.totalCount,
        sentCount: m.sentCount,
        failedCount: m.failedCount,
        suppressedCount: m.suppressedCount,
        openCount: m.openCount,
        clickCount: m.clickCount,
        scheduledAt: m.scheduledAt?.toISOString() ?? null,
        sentAt: m.sentAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  );
}
```

- [ ] **Step 2: campaigns list client**

```tsx
// src/app/(dashboard)/email-center/campaigns/campaigns-client.tsx
"use client";

/** Campaigns tab: Klaviyo-style blast list with status pills and quick stats. */
import { useState } from "react";
import Link from "next/link";

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  templateName: string | null;
  fromName: string | null;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  openCount: number;
  clickCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

const STATUS_PILL: Record<string, string> = {
  DRAFT: "ec-pill-neutral",
  SCHEDULED: "ec-pill-amber",
  SENDING: "ec-pill-amber",
  SENT: "ec-pill-live",
  FAILED: "ec-pill-danger",
  CANCELED: "ec-pill-neutral",
};

function rate(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function CampaignsClient({ campaigns: initial }: { campaigns: CampaignRow[] }) {
  const [campaigns, setCampaigns] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function cancel(id: string) {
    setBusy(id);
    const res = await fetch(`/api/emails/mass/${id}/cancel`, { method: "POST" });
    if (res.ok) {
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: "CANCELED" } : c)));
    }
    setBusy(null);
  }

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Campaigns</h1>
          <p className="ec-flows-sub">One-time email blasts to segments, list views, or dialer campaigns.</p>
        </div>
        <Link className="ec-btn ec-btn-primary" href="/email-center/campaigns/new">New Campaign</Link>
      </div>
      {campaigns.length === 0 ? (
        <div className="ec-empty" style={{ paddingTop: 60 }}>
          <div className="ec-empty-title">No campaigns yet</div>
          <div className="ec-empty-sub">Create your first blast and pick an audience.</div>
        </div>
      ) : (
        <div className="ec-flows-list">
          {campaigns.map((c) => (
            <div key={c.id} className="ec-flow-row">
              <Link href={`/email-center/campaigns/${c.id}`} className="ec-flow-main">
                <span className="ec-flow-name">{c.name}</span>
                <span className="ec-flow-desc">
                  {c.templateName ?? "No template"}
                  {c.fromName ? ` · from ${c.fromName}` : ""}
                  {c.scheduledAt && c.status === "SCHEDULED"
                    ? ` · scheduled ${new Date(c.scheduledAt).toLocaleString()}`
                    : ""}
                </span>
              </Link>
              {c.status === "SENT" ? (
                <span className="ec-flow-stat">
                  {c.sentCount} sent · {rate(c.openCount, c.sentCount)} open · {rate(c.clickCount, c.sentCount)} click
                  {c.suppressedCount ? ` · ${c.suppressedCount} suppressed` : ""}
                </span>
              ) : (
                <span className="ec-flow-stat">{c.totalCount ? `${c.totalCount} recipients` : ""}</span>
              )}
              <span className={`ec-pill ${STATUS_PILL[c.status] ?? "ec-pill-neutral"}`}>
                {c.status.toLowerCase()}
              </span>
              {c.status === "DRAFT" || c.status === "SCHEDULED" ? (
                <button className="ec-btn ec-btn-ghost" disabled={busy === c.id} onClick={() => void cancel(c.id)}>
                  Cancel
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: new-campaign wizard**

`src/app/(dashboard)/email-center/campaigns/new/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WizardClient } from "./wizard-client";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function NewCampaignPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true },
  });
  if (!me) redirect("/login");
  const [templates, segments, listViews, dialerCampaigns, users] = await Promise.all([
    prisma.emailTemplate.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.segment.findMany({ select: { id: true, name: true, entity: true }, orderBy: { name: "asc" } }),
    prisma.listView.findMany({
      where: { entity: { in: ["Lead", "Contact"] } },
      select: { id: true, name: true, entity: true },
      orderBy: [{ entity: "asc" }, { name: "asc" }],
    }),
    prisma.campaign.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ADMIN_ROLES.includes(me.role)
      ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  return (
    <WizardClient
      me={{ id: me.id, name: me.name }}
      templates={templates}
      segments={segments}
      listViews={listViews}
      dialerCampaigns={dialerCampaigns}
      users={users}
    />
  );
}
```

`src/app/(dashboard)/email-center/campaigns/new/wizard-client.tsx`:

```tsx
"use client";

/**
 * New campaign wizard: name + from + template + multi-source audience with a
 * live combined count + send now / schedule / throttle. Creates the MassEmail
 * draft then either sends or schedules through /api/emails/mass/[id]/send.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Option { id: string; name: string; entity?: string }
interface Source { type: "segment" | "listview" | "campaign"; id: string }

export function WizardClient({
  me, templates, segments, listViews, dialerCampaigns, users,
}: {
  me: { id: string; name: string };
  templates: Option[];
  segments: Option[];
  listViews: Option[];
  dialerCampaigns: Option[];
  users: Option[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [fromUserId, setFromUserId] = useState(me.id);
  const [sources, setSources] = useState<Source[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [throttle, setThrottle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCount = useCallback((next: Source[]) => {
    if (countTimer.current) clearTimeout(countTimer.current);
    if (next.length === 0) { setCount(null); return; }
    countTimer.current = setTimeout(async () => {
      const res = await fetch("/api/emails/mass/audience-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceType: "sources", audienceSources: next }),
      });
      const data = await res.json().catch(() => ({}));
      setCount(typeof data.count === "number" ? data.count : null);
    }, 350);
  }, []);

  function toggleSource(type: Source["type"], id: string) {
    setSources((prev) => {
      const exists = prev.some((s) => s.type === type && s.id === id);
      const next = exists ? prev.filter((s) => !(s.type === type && s.id === id)) : [...prev, { type, id }];
      refreshCount(next);
      return next;
    });
  }

  const picked = (type: Source["type"], id: string) => sources.some((s) => s.type === type && s.id === id);

  async function launch() {
    setBusy(true);
    setError(null);
    const createRes = await fetch("/api/emails/mass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        templateId: templateId || undefined,
        fromUserId,
        audienceType: "sources",
        audienceSources: sources,
        throttlePerMinute: throttle ? Number(throttle) : undefined,
      }),
    });
    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !created.id) {
      setBusy(false);
      setError(created.error ?? "Could not create campaign");
      return;
    }
    const sendRes = await fetch(`/api/emails/mass/${created.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(when === "later" && scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
    });
    const sent = await sendRes.json().catch(() => ({}));
    setBusy(false);
    if (!sendRes.ok) {
      setError(sent.error ?? "Send failed");
      return;
    }
    router.push("/email-center/campaigns");
  }

  useEffect(() => () => { if (countTimer.current) clearTimeout(countTimer.current); }, []);

  const canLaunch = name.trim() && templateId && sources.length > 0 && (when === "now" || scheduledAt);

  function sourceGroup(title: string, type: Source["type"], options: Option[]) {
    if (options.length === 0) return null;
    return (
      <div style={{ marginBottom: 10 }}>
        <div className="ec-field-label">{title}</div>
        <div className="ec-source-grid">
          {options.map((o) => (
            <button
              key={o.id}
              className={`ec-source-chip${picked(type, o.id) ? " ec-source-chip-on" : ""}`}
              onClick={() => toggleSource(type, o.id)}
            >
              {o.name}
              {o.entity ? <span className="ec-source-chip-sub">{o.entity}</span> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">New Campaign</h1>
          <p className="ec-flows-sub">Pick who gets it, what they get, and when.</p>
        </div>
      </div>
      <div className="ec-seg-editor" style={{ maxWidth: 760 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label className="ec-field-label">Campaign name</label>
            <input className="ec-input" value={name} placeholder="August payoff promo"
              onChange={(e) => setName(e.target.value)} />
          </div>
          {users.length > 0 ? (
            <div style={{ width: 220 }}>
              <label className="ec-field-label">Send as</label>
              <select className="ec-select" value={fromUserId} onChange={(e) => setFromUserId(e.target.value)}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="ec-field-label">Template</label>
          <select className="ec-select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Pick a template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 14 }}>
          <label className="ec-field-label">Audience (union of everything selected, deduped by email)</label>
          {sourceGroup("Segments", "segment", segments)}
          {sourceGroup("List Views", "listview", listViews)}
          {sourceGroup("Dialer Campaigns", "campaign", dialerCampaigns)}
          <span className="ec-pill ec-pill-green">
            {sources.length === 0 ? "Nothing selected" : count === null ? "Counting..." : `~${count.toLocaleString()} recipients before dedupe/suppression`}
          </span>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label className="ec-field-label">When</label>
            <select className="ec-select" value={when} onChange={(e) => setWhen(e.target.value as "now" | "later")}>
              <option value="now">Send now</option>
              <option value="later">Schedule</option>
            </select>
          </div>
          {when === "later" ? (
            <div>
              <label className="ec-field-label">Send at</label>
              <input className="ec-input" type="datetime-local" value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          ) : null}
          <div style={{ width: 190 }}>
            <label className="ec-field-label">Throttle (emails/min, optional)</label>
            <input className="ec-input" type="number" min={1} max={600} value={throttle} placeholder="Full speed"
              onChange={(e) => setThrottle(e.target.value)} />
          </div>
        </div>
        {error ? <div className="ec-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div className="ec-seg-editor-foot">
          <span style={{ flex: 1 }} />
          <button className="ec-btn ec-btn-ghost" onClick={() => router.push("/email-center/campaigns")}>Cancel</button>
          <button className="ec-btn ec-btn-primary" disabled={busy || !canLaunch} onClick={() => void launch()}>
            {busy ? "Working..." : when === "later" ? "Schedule Campaign" : "Send Campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: campaign detail page (server-only, no client needed)**

```tsx
// src/app/(dashboard)/email-center/campaigns/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function rate(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mass = await prisma.massEmail.findUnique({
    where: { id },
    include: {
      template: { select: { name: true } },
      fromUser: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true, toAddresses: true, status: true, openCount: true, clickCount: true, errorReason: true,
        },
      },
    },
  });
  if (!mass) notFound();
  const stats: Array<{ label: string; value: string }> = [
    { label: "Recipients", value: String(mass.totalCount) },
    { label: "Sent", value: String(mass.sentCount) },
    { label: "Failed", value: String(mass.failedCount) },
    { label: "Suppressed", value: String(mass.suppressedCount) },
    { label: "Open rate", value: rate(mass.openCount, mass.sentCount) },
    { label: "Click rate", value: rate(mass.clickCount, mass.sentCount) },
  ];
  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">{mass.name}</h1>
          <p className="ec-flows-sub">
            {mass.status.toLowerCase()}
            {mass.template?.name ? ` · ${mass.template.name}` : ""}
            {mass.fromUser?.name ? ` · from ${mass.fromUser.name}` : ""}
            {mass.sentAt ? ` · sent ${mass.sentAt.toLocaleString()}` : ""}
          </p>
        </div>
        <Link className="ec-btn ec-btn-ghost" href="/email-center/campaigns">Back</Link>
      </div>
      <div className="ec-stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="ec-stat-card">
            <div className="ec-stat-value">{s.value}</div>
            <div className="ec-stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="ec-flows-list" style={{ marginTop: 18 }}>
        {mass.messages.map((m) => (
          <div key={m.id} className="ec-flow-row">
            <span className="ec-flow-main" style={{ fontSize: 13 }}>{m.toAddresses}</span>
            {m.openCount > 0 ? <span className="ec-pill ec-pill-green">{m.openCount} opens</span> : null}
            {m.clickCount > 0 ? <span className="ec-pill ec-pill-green">{m.clickCount} clicks</span> : null}
            {m.errorReason ? <span className="ec-flow-stat">{m.errorReason.slice(0, 60)}</span> : null}
            <span className={`ec-pill ${m.status === "FAILED" ? "ec-pill-danger" : "ec-pill-neutral"}`}>
              {m.status.toLowerCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: CSS + rail**

Append to email-center.css:

```css
/* ---------- Campaigns ---------- */

.ec-pill-danger {
  background: var(--ec-danger-soft);
  color: var(--ec-danger);
}

.ec-source-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ec-source-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--ec-border);
  background: #ffffff;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12.5px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.ec-source-chip:hover {
  border-color: #131313;
}

.ec-source-chip-on {
  background: #131313;
  color: #ffffff;
  border-color: #131313;
}

.ec-source-chip-sub {
  font-size: 10px;
  color: var(--ec-faint);
}

.ec-source-chip-on .ec-source-chip-sub {
  color: rgba(255, 255, 255, 0.6);
}

.ec-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  max-width: 920px;
}

.ec-stat-card {
  background: #ffffff;
  border: 1px solid var(--ec-border);
  border-radius: 12px;
  padding: 14px 16px;
}

.ec-stat-value {
  font-size: 20px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.ec-stat-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ec-faint);
  margin-top: 2px;
}
```

In tab-rail.tsx remove `soon: "1b"` from the Campaigns entry.

- [ ] **Step 6: verify + commit**

`npx tsc --noEmit 2>&1 | grep -iE "email-center/campaigns" || echo CLEAN`; dev compile check.

```bash
git add "src/app/(dashboard)/email-center"
git commit -m "Campaigns UI: list with stats, multi-source wizard, detail report"
```

---

### Task 7: Full verification + E2E

- [ ] **Step 1: suite + build + lint**

`npx vitest run` (expect ~180+ green), `npm run build`, `npx eslint "src/app/(dashboard)/email-center" src/lib/email src/app/api/emails src/app/api/email-center 2>&1 | tail -3`.

- [ ] **Step 2: browser E2E (local DB, PORT=3013, FLOW_POLL_SECRET=schedtest)**

Seed (throwaway scripts, reuse the SUPER_ADMIN + System_Administrator profile + bcrypt pattern from earlier E2Es): an admin user with mailboxAddress, an EmailTemplate (simple subject/bodyHtml with {{firstName}}), 3 leads with distinct emails (one shared with a Contact to prove dedupe if quick), 1 suppressed lead (EmailSuppression row), a ListView for Leads if none exists with matching filters.

Then in Playwright:
1. Segments: create "E2E Web Leads" segment (Lead, one condition), watch the live count populate, save, confirm it appears in the list.
2. Campaigns wizard: create a campaign with the segment + a list view selected, watch the combined count, pick template, Send now. Expect redirect to the list with the campaign SENT or FAILED rows visible (Resend absent locally: per-message FAILED is fine; campaign row totals should show recipients minus the suppressed one in totalCount, suppressedCount 1).
3. Campaign detail page: stats cards render; recipient rows listed; suppressed address NOT among them.
4. Unsubscribe: grab one message's trackingId from the DB, GET /api/emails/unsubscribe/<trackingId> in the browser, confirm the confirmation page renders and an EmailSuppression row with reason UNSUBSCRIBE exists for that address.
5. Scheduling: create a second campaign scheduled 1 minute out; confirm status SCHEDULED in the list; `curl -X POST -H "Authorization: Bearer schedtest" /api/emails/mass/process-scheduled` after the minute passes (or set scheduledAt in the past directly) and confirm it flips to SENT/FAILED and processed count 1. Also verify cancel on a fresh SCHEDULED campaign flips it to CANCELED and process-scheduled then skips it.
6. Screenshots: segments builder, campaigns list, wizard, detail page.
7. Clean up everything (campaigns + messages + segment + leads + suppression + user + scripts), kill the server, `git status --short` clean.

- [ ] **Step 3: commit anything outstanding; do NOT push**

Deploy notes to surface in the final report: the external cron needs a third POST to `/api/emails/mass/process-scheduled` every minute (alongside /api/flow/poll and /api/flow/sweep); unsubscribe links use the request-origin tracking base URL env (`getTrackingBaseUrl()`), verify it points at the public CRM URL in prod.
