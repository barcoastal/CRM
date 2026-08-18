# Email Center Phase 1c: Reports + Domain Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email analytics (an EmailEvent log feeding overview/campaign/flow dashboards and a per-record activity panel) plus a Domain Health page (SPF/DKIM/DMARC checks, self-computed reputation score, DNSBL blacklist checks) with a daily snapshot cron.

**Architecture:** Two independent subsystems. Reports (Tasks 1-7) adds a granular `EmailEvent` table written by the existing pixel/click routes and Resend webhook, then pure analytics libs power read-only dashboard APIs and UI. Domain Health (Tasks 8-12) adds DNS/DNSBL lookups and a reputation scorer over existing send data, persisted as `DomainHealthSnapshot` rows refreshed by a bearer-authed cron. Everything reuses the monochrome `.ec-` design system and the cron-auth pattern already in the repo.

**Tech Stack:** Next.js App Router, Prisma/Postgres (`prisma db push`, no migrations dir), Node `dns/promises`, Resend, vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-email-center-design.md` sections 6 (Reports) and 7 (Domain Health). Deliberately EXCLUDED (do not flag): scheduled-report emails, CSV export, geo/device analytics, per-IP Resend reputation (Resend uses shared IPs not exposed per-account, so blacklist checks target the sending domain plus an optional configured IP).

**Codebase facts the engineer needs:**
- `EmailMessage` (schema ~line 1900) already tracks per-message analytics: `status` (QUEUED|SENT|DELIVERED|OPENED|CLICKED|BOUNCED|COMPLAINED|FAILED), `openCount`/`clickCount` (every-hit counters), `openedAt`/`clickedAt`/`firstClickedAt`, `deliveredAt`, `bouncedAt`, `trackingId` (unique), `massEmailId`, `flowId`/`flowRunId`, `leadId`/`contactId`/`accountId`/`opportunityId`/`caseId`, `ownerId`, `errorReason`, `createdAt`.
- Open pixel: `src/app/api/emails/track/[trackingId]/pixel.gif/route.ts` - looks up EmailMessage by trackingId, increments openCount, sets openedAt/status on first open, bumps MassEmail.openCount on first open. Public, best-effort (try/catch swallow).
- Click redirect: `src/app/api/emails/track/[trackingId]/click/route.ts` - decodes `?u=`, increments clickCount, sets firstClickedAt/clickedAt/status, bumps MassEmail.clickCount on first click, 302-redirects. Public.
- Resend webhook: `src/app/api/emails/webhook/resend/route.ts` - verifies svix sig, maps `body.type` (email.delivered/opened/clicked/bounced/complained/failed) via STATUS_MAP with a RANK guard (never downgrades), finds EmailMessage by `providerMessageId` (= `body.data.email_id`), updates status + timestamp, and already feeds EmailSuppression on bounce/complaint. `body.data` also carries `to`, `reason`, `bounce`, and (for click events) `body.data.click.link`.
- `EmailSuppression` model + `src/lib/email/suppression.ts` (from Flows build): reasons HARD_BOUNCE|COMPLAINT|UNSUBSCRIBE|MANUAL. Unsubscribe route writes UNSUBSCRIBE.
- `MassEmail` (campaign) has totalCount/sentCount/failedCount/suppressedCount/openCount/clickCount; campaign detail page exists at `src/app/(dashboard)/email-center/campaigns/[id]/page.tsx` (stat cards + recipient rows).
- `Flow`/`FlowRun`: flow runs at `prisma.flowRun` (flowId, entityId, status, startedAt). Flow email sends carry `flowId`/`flowRunId` on EmailMessage.
- Cron auth (copy verbatim): `authorize(req)` in `src/app/api/flow/sweep/route.ts` - Bearer `FLOW_POLL_SECRET`, fallback `PROCESSOR_SYNC_SECRET`. A launchd job on the mini (`~/crm-cron/run.sh`) already calls `/api/flow/poll` + `/api/emails/mass/process-scheduled` each minute and `/api/flow/sweep` at 03:00; add the domain-health refresh to the 03:00 branch as a deploy note.
- Email Center UI: `.ec-` classes in `src/app/(dashboard)/email-center/email-center.css` (monochrome: black rail `--ec-forest`/#161616, white cards, lime `--ec-lime` #d9fe62, `.ec-btn-primary` black, `.ec-pill`/`.ec-pill-neutral`/`.ec-pill-green`/`.ec-pill-danger`/`.ec-pill-live`/`.ec-pill-amber`, `.ec-flows-wrap`/`.ec-flows-head`/`.ec-flows-title`/`.ec-flows-sub`, `.ec-flows-list`/`.ec-flow-row`, `.ec-stat-grid`/`.ec-stat-card`/`.ec-stat-value`/`.ec-stat-label`, `.ec-empty`). Rail: `src/app/(dashboard)/email-center/tab-rail.tsx` - Reports and Domain Health entries carry `soon: "1c"` (remove per task). Placeholders to replace: `email-center/reports/page.tsx`, `email-center/domain-health/page.tsx`.
- Admin gate: `requireAuthOrRespond("Email.Send")` returns `r.session.userId`/`r.session.role`; ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"]. Reuse the threads-route pattern: non-admins see only their own (ownerId) data, admins see all and may filter by user.
- Lead detail page: `src/app/(dashboard)/leads/[id]/page.tsx` renders `src/components/leads/lead-detail-tabs.tsx` (tabs: overview/debts/calls/campaigns/documents/notes, plus an Activity Timeline block). The Email Activity panel is a shared component dropped into lead/account/contact detail pages.
- Tests: vitest, `tests/*.test.ts`, `@` aliased to `./src`. Local DB: `postgresql://postgres:postgres@localhost:5432/crm_local` (repo .env is stale sqlite; ALWAYS override DATABASE_URL). psql at `/Applications/Postgres.app/Contents/Versions/latest/bin/psql` user `postgres`.
- No em dashes anywhere. Never push to the remote (Bar deploys explicitly).

---

## PART A - REPORTS

### Task 1: EmailEvent schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the EmailEvent model**

Add near `model EmailMessage` (after it closes):

```prisma
// Granular email engagement log. One row per open/click/delivery/bounce/etc.
// The per-message openCount/clickCount fields stay as fast counters; this table
// powers time-series, unique counts, and top-clicked-URL reports. Written by the
// tracking pixel/click routes and the Resend webhook, best-effort.
model EmailEvent {
  id             String       @id @default(cuid())
  emailMessageId String
  emailMessage   EmailMessage @relation("EmailMessageEvents", fields: [emailMessageId], references: [id], onDelete: Cascade)
  // DELIVERED | OPEN | CLICK | BOUNCE | COMPLAINT | UNSUBSCRIBE | FAILED
  type           String
  url            String? // for CLICK events, the destination link
  userAgent      String?
  ip             String?
  // Denormalized for fast report grouping without joining EmailMessage.
  massEmailId    String?
  flowId         String?
  ownerId        String?
  occurredAt     DateTime     @default(now())

  @@index([type, occurredAt])
  @@index([massEmailId])
  @@index([flowId])
  @@index([ownerId, occurredAt])
  @@index([emailMessageId])
}
```

- [ ] **Step 2: Add the relation on EmailMessage**

In `model EmailMessage`, add near its other relations:

```prisma
  events EmailEvent[] @relation("EmailMessageEvents")
```

- [ ] **Step 3: Push + generate + validate**

Run: `npx prisma validate && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_local" npx prisma db push --accept-data-loss && npx prisma generate`
Expected: valid, in sync, client generated.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "Reports: EmailEvent granular engagement log"
```

---

### Task 2: Event recording lib + wire pixel/click/webhook

**Files:**
- Create: `src/lib/email/events.ts`
- Modify: `src/app/api/emails/track/[trackingId]/pixel.gif/route.ts`
- Modify: `src/app/api/emails/track/[trackingId]/click/route.ts`
- Modify: `src/app/api/emails/webhook/resend/route.ts`
- Test: `tests/email-events.test.ts`

- [ ] **Step 1: Write the failing test for the pure de-dup helper**

```typescript
// tests/email-events.test.ts
import { describe, it, expect } from "vitest";
import { isUniqueEvent } from "@/lib/email/events";

describe("isUniqueEvent", () => {
  it("OPEN is unique only when openedAt was not previously set", () => {
    expect(isUniqueEvent("OPEN", { openedAt: null, firstClickedAt: null })).toBe(true);
    expect(isUniqueEvent("OPEN", { openedAt: new Date(), firstClickedAt: null })).toBe(false);
  });
  it("CLICK is unique only when firstClickedAt was not previously set", () => {
    expect(isUniqueEvent("CLICK", { openedAt: null, firstClickedAt: null })).toBe(true);
    expect(isUniqueEvent("CLICK", { openedAt: null, firstClickedAt: new Date() })).toBe(false);
  });
  it("other event types are always recorded (treated as unique)", () => {
    expect(isUniqueEvent("BOUNCE", { openedAt: null, firstClickedAt: null })).toBe(true);
    expect(isUniqueEvent("DELIVERED", { openedAt: new Date(), firstClickedAt: new Date() })).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify FAIL (module not found)**

Run: `npx vitest run tests/email-events.test.ts`

- [ ] **Step 3: Implement the events lib**

```typescript
// src/lib/email/events.ts
/**
 * EmailEvent recording. The tracking routes and Resend webhook call recordEmailEvent
 * to append a granular engagement row alongside the fast per-message counters.
 * All writes are best-effort: callers wrap in try/catch or .catch so tracking
 * pixels and webhooks never fail because of an analytics write.
 */
import { prisma } from "@/lib/prisma";

export type EmailEventType =
  | "DELIVERED"
  | "OPEN"
  | "CLICK"
  | "BOUNCE"
  | "COMPLAINT"
  | "UNSUBSCRIBE"
  | "FAILED";

/** For open/click, "unique" means the first occurrence for that message. */
export function isUniqueEvent(
  type: EmailEventType,
  msg: { openedAt: Date | null; firstClickedAt: Date | null },
): boolean {
  if (type === "OPEN") return msg.openedAt === null;
  if (type === "CLICK") return msg.firstClickedAt === null;
  return true;
}

export async function recordEmailEvent(args: {
  emailMessageId: string;
  type: EmailEventType;
  url?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  massEmailId?: string | null;
  flowId?: string | null;
  ownerId?: string | null;
}): Promise<void> {
  try {
    await prisma.emailEvent.create({
      data: {
        emailMessageId: args.emailMessageId,
        type: args.type,
        url: args.url ?? null,
        userAgent: args.userAgent ?? null,
        ip: args.ip ?? null,
        massEmailId: args.massEmailId ?? null,
        flowId: args.flowId ?? null,
        ownerId: args.ownerId ?? null,
      },
    });
  } catch {
    // best-effort; analytics must never break the caller
  }
}
```

- [ ] **Step 4: Run test, PASS. Full `npx vitest run` green.**

- [ ] **Step 5: Wire the open pixel**

In `src/app/api/emails/track/[trackingId]/pixel.gif/route.ts`, extend the EmailMessage select to include the denormalization fields and record an OPEN event. Replace the `try { ... }` block body with:

```typescript
    const msg = await prisma.emailMessage.findUnique({
      where: { trackingId },
      select: { id: true, openedAt: true, firstClickedAt: true, massEmailId: true, flowId: true, ownerId: true },
    });
    if (msg) {
      const isFirst = !msg.openedAt;
      await prisma.emailMessage.update({
        where: { id: msg.id },
        data: {
          openCount: { increment: 1 },
          openedAt: msg.openedAt ?? new Date(),
          status: isFirst ? "OPENED" : undefined,
        },
      });
      if (isFirst && msg.massEmailId) {
        await prisma.massEmail.update({
          where: { id: msg.massEmailId },
          data: { openCount: { increment: 1 } },
        });
      }
      await recordEmailEvent({
        emailMessageId: msg.id,
        type: "OPEN",
        userAgent: _req.headers.get("user-agent"),
        ip: _req.headers.get("x-forwarded-for"),
        massEmailId: msg.massEmailId,
        flowId: msg.flowId,
        ownerId: msg.ownerId,
      });
    }
```

Add `import { recordEmailEvent } from "@/lib/email/events";` at the top. Rename the handler's `_req` param to `req` since it is now used (both `GET(req, ...)`).

- [ ] **Step 6: Wire the click redirect**

In `src/app/api/emails/track/[trackingId]/click/route.ts`, extend the select and record a CLICK event. Replace the `if (msg) { ... }` body with:

```typescript
    const msg = await prisma.emailMessage.findUnique({
      where: { trackingId },
      select: { id: true, openedAt: true, firstClickedAt: true, massEmailId: true, flowId: true, ownerId: true },
    });
    if (msg) {
      const isFirst = !msg.firstClickedAt;
      const now = new Date();
      await prisma.emailMessage.update({
        where: { id: msg.id },
        data: {
          clickCount: { increment: 1 },
          firstClickedAt: msg.firstClickedAt ?? now,
          clickedAt: now,
          status: "CLICKED",
        },
      });
      if (isFirst && msg.massEmailId) {
        await prisma.massEmail.update({
          where: { id: msg.massEmailId },
          data: { clickCount: { increment: 1 } },
        });
      }
      await recordEmailEvent({
        emailMessageId: msg.id,
        type: "CLICK",
        url: target,
        userAgent: req.headers.get("user-agent"),
        ip: req.headers.get("x-forwarded-for"),
        massEmailId: msg.massEmailId,
        flowId: msg.flowId,
        ownerId: msg.ownerId,
      });
    }
```

Add the import. `target` and `req` are already in scope.

- [ ] **Step 7: Wire the Resend webhook**

In `src/app/api/emails/webhook/resend/route.ts`, after the successful `prisma.emailMessage.update(...)` near the end, record the corresponding event. First widen the `msg` select to include denormalization fields:

```typescript
  const msg = await prisma.emailMessage.findFirst({
    where: { providerMessageId },
    select: { id: true, status: true, massEmailId: true, flowId: true, ownerId: true },
  });
```

Then after the update, add:

```typescript
  const EVENT_FOR: Record<string, import("@/lib/email/events").EmailEventType | undefined> = {
    "email.delivered": "DELIVERED",
    "email.opened": "OPEN",
    "email.clicked": "CLICK",
    "email.bounced": "BOUNCE",
    "email.complained": "COMPLAINT",
    "email.failed": "FAILED",
  };
  const evType = EVENT_FOR[eventType];
  if (evType) {
    await recordEmailEvent({
      emailMessageId: msg.id,
      type: evType,
      url: eventType === "email.clicked" ? ((body.data as Record<string, unknown>)?.click as { link?: string } | undefined)?.link ?? null : null,
      massEmailId: msg.massEmailId,
      flowId: msg.flowId,
      ownerId: msg.ownerId,
    });
  }
```

Add `import { recordEmailEvent } from "@/lib/email/events";`. Note: opens/clicks may be double-counted between the pixel/click routes and the Resend webhook; the reports lib (Task 3) counts UNIQUE opens/clicks per message, so raw EmailEvent duplicates do not distort headline rates. Keep both sources for resilience.

- [ ] **Step 8: Wire the unsubscribe route (so reports count unsubscribes)**

The 1b unsubscribe route writes EmailSuppression but not EmailEvent, so without this the reports unsubscribe rate is always zero. In `src/app/api/emails/unsubscribe/[trackingId]/route.ts`, the `suppressByTrackingId` helper already loads the message by trackingId; widen its select and record an UNSUBSCRIBE event. Change the message lookup to:

```typescript
  const msg = await prisma.emailMessage.findUnique({
    where: { trackingId },
    select: { id: true, toAddresses: true, massEmailId: true, flowId: true, ownerId: true },
  });
```

and after the `addEmailSuppression(email, "UNSUBSCRIBE", ...)` call, add:

```typescript
  await recordEmailEvent({
    emailMessageId: msg.id,
    type: "UNSUBSCRIBE",
    massEmailId: msg.massEmailId,
    flowId: msg.flowId,
    ownerId: msg.ownerId,
  });
```

Add `import { recordEmailEvent } from "@/lib/email/events";`.

- [ ] **Step 9: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "events|track|webhook/resend|unsubscribe" || echo CLEAN`; `npx vitest run` green.

```bash
git add src/lib/email/events.ts tests/email-events.test.ts "src/app/api/emails/track" src/app/api/emails/webhook/resend/route.ts "src/app/api/emails/unsubscribe"
git commit -m "Reports: record EmailEvent rows from pixel, click, webhook, and unsubscribe"
```

---

### Task 3: Reports analytics lib (TDD)

**Files:**
- Create: `src/lib/email/reports.ts`
- Test: `tests/email-reports.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/email-reports.test.ts
import { describe, it, expect } from "vitest";
import { computeRates, bucketByDay, topUrls, type MessageAgg } from "@/lib/email/reports";

const agg: MessageAgg = {
  total: 100,
  delivered: 90,
  uniqueOpens: 45,
  uniqueClicks: 12,
  bounced: 6,
  complained: 1,
  unsubscribed: 2,
  failed: 4,
};

describe("computeRates", () => {
  it("computes rates against the right denominators", () => {
    const r = computeRates(agg);
    expect(r.deliveryRate).toBe(90); // delivered / total
    expect(r.openRate).toBe(50); // uniqueOpens / delivered
    expect(r.clickRate).toBe(13.3); // uniqueClicks / delivered, 1 decimal
    expect(r.clickToOpenRate).toBe(26.7); // uniqueClicks / uniqueOpens
    expect(r.bounceRate).toBe(6); // bounced / total
    expect(r.unsubscribeRate).toBe(2.2); // unsubscribed / delivered
  });
  it("never divides by zero", () => {
    const r = computeRates({ total: 0, delivered: 0, uniqueOpens: 0, uniqueClicks: 0, bounced: 0, complained: 0, unsubscribed: 0, failed: 0 });
    expect(r.deliveryRate).toBe(0);
    expect(r.openRate).toBe(0);
    expect(r.clickToOpenRate).toBe(0);
  });
});

describe("bucketByDay", () => {
  it("counts events per YYYY-MM-DD in UTC", () => {
    const rows = [
      { occurredAt: new Date("2026-08-01T10:00:00Z") },
      { occurredAt: new Date("2026-08-01T23:59:00Z") },
      { occurredAt: new Date("2026-08-02T00:01:00Z") },
    ];
    expect(bucketByDay(rows)).toEqual([
      { day: "2026-08-01", count: 2 },
      { day: "2026-08-02", count: 1 },
    ]);
  });
  it("returns an empty array for no rows", () => {
    expect(bucketByDay([])).toEqual([]);
  });
});

describe("topUrls", () => {
  it("ranks click urls by frequency, descending, capped", () => {
    const rows = [
      { url: "https://a.com" },
      { url: "https://a.com" },
      { url: "https://b.com" },
      { url: null },
    ];
    expect(topUrls(rows, 5)).toEqual([
      { url: "https://a.com", count: 2 },
      { url: "https://b.com", count: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

Run: `npx vitest run tests/email-reports.test.ts`

- [ ] **Step 3: Implement**

```typescript
// src/lib/email/reports.ts
/**
 * Pure analytics for the Email Center reports. All rates are percentages
 * rounded to one decimal. Denominators follow email-industry convention:
 * open/click/unsubscribe rates are over DELIVERED, delivery/bounce over TOTAL.
 */

export interface MessageAgg {
  total: number;
  delivered: number;
  uniqueOpens: number;
  uniqueClicks: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  failed: number;
}

export interface Rates {
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  bounceRate: number;
  complaintRate: number;
  unsubscribeRate: number;
}

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function computeRates(a: MessageAgg): Rates {
  return {
    deliveryRate: pct(a.delivered, a.total),
    openRate: pct(a.uniqueOpens, a.delivered),
    clickRate: pct(a.uniqueClicks, a.delivered),
    clickToOpenRate: pct(a.uniqueClicks, a.uniqueOpens),
    bounceRate: pct(a.bounced, a.total),
    complaintRate: pct(a.complained, a.total),
    unsubscribeRate: pct(a.unsubscribed, a.delivered),
  };
}

export function bucketByDay(rows: Array<{ occurredAt: Date }>): Array<{ day: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const day = r.occurredAt.toISOString().slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day, count }));
}

export function topUrls(rows: Array<{ url: string | null }>, limit: number): Array<{ url: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.url) continue;
    map.set(r.url, (map.get(r.url) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([url, count]) => ({ url, count }));
}
```

- [ ] **Step 4: Run tests, PASS. Full suite green.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/reports.ts tests/email-reports.test.ts
git commit -m "Reports: pure analytics lib (rates, day buckets, top urls)"
```

---

### Task 4: Reports overview API

**Files:**
- Create: `src/app/api/email-center/reports/overview/route.ts`

- [ ] **Step 1: Implement the overview endpoint**

```typescript
// src/app/api/email-center/reports/overview/route.ts
/**
 * GET /api/email-center/reports/overview?days=30&user=<id|all>&campaign=<id>&flow=<id>
 *
 * Returns headline rates, a daily send trend, and top clicked URLs for the
 * scope. Non-admins are locked to their own ownerId; admins may pass ?user=.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { computeRates, bucketByDay, topUrls, type MessageAgg } from "@/lib/email/reports";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? "30"), 1), 365);
  const since = new Date(Date.now() - days * 864e5);
  const isAdmin = ADMIN_ROLES.includes(r.session.role);
  const userParam = url.searchParams.get("user");
  const campaignId = url.searchParams.get("campaign");
  const flowId = url.searchParams.get("flow");

  // Ownership scope: non-admins locked to self; admins may target a user or all.
  let ownerId: string | undefined = r.session.userId;
  if (isAdmin) {
    if (userParam === "all" || !userParam) ownerId = undefined;
    else ownerId = userParam;
  }

  const msgWhere = {
    direction: "OUTBOUND",
    createdAt: { gte: since },
    ...(ownerId ? { ownerId } : {}),
    ...(campaignId ? { massEmailId: campaignId } : {}),
    ...(flowId ? { flowId } : {}),
  } as const;

  // Aggregate message-level analytics with grouped counts.
  const [total, delivered, uniqueOpens, uniqueClicks, byStatus, sendRows, clickRows] = await Promise.all([
    prisma.emailMessage.count({ where: msgWhere }),
    prisma.emailMessage.count({ where: { ...msgWhere, deliveredAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...msgWhere, openedAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...msgWhere, firstClickedAt: { not: null } } }),
    prisma.emailMessage.groupBy({ by: ["status"], where: msgWhere, _count: true }),
    prisma.emailMessage.findMany({ where: msgWhere, select: { createdAt: true }, take: 20000 }),
    // Click URLs: pull CLICK events in scope (denormalized fields make this cheap).
    prisma.emailEvent.findMany({
      where: {
        type: "CLICK",
        occurredAt: { gte: since },
        ...(ownerId ? { ownerId } : {}),
        ...(campaignId ? { massEmailId: campaignId } : {}),
        ...(flowId ? { flowId } : {}),
      },
      select: { url: true },
      take: 20000,
    }),
  ]);

  const statusCount = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const unsubscribed = await prisma.emailEvent.count({
    where: {
      type: "UNSUBSCRIBE",
      occurredAt: { gte: since },
      ...(ownerId ? { ownerId } : {}),
      ...(campaignId ? { massEmailId: campaignId } : {}),
      ...(flowId ? { flowId } : {}),
    },
  });

  const agg: MessageAgg = {
    total,
    delivered,
    uniqueOpens,
    uniqueClicks,
    bounced: statusCount("BOUNCED"),
    complained: statusCount("COMPLAINED"),
    unsubscribed,
    failed: statusCount("FAILED"),
  };

  return NextResponse.json({
    days,
    scope: { ownerId: ownerId ?? "all", campaignId, flowId },
    totals: agg,
    rates: computeRates(agg),
    trend: bucketByDay(sendRows),
    topUrls: topUrls(clickRows, 10),
  });
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -iE "reports/overview" || echo CLEAN`; `npx vitest run` green.

Functional (local DB, dev server PORT=3020): unauthenticated GET returns 401/redirect (auth gating). Deeper checks happen in the Task 7/13 E2E once seed data exists.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/email-center/reports/overview/route.ts
git commit -m "Reports: overview API with rates, trend, top urls, ownership scope"
```

---

### Task 5: Reports overview dashboard UI

**Files:**
- Replace: `src/app/(dashboard)/email-center/reports/page.tsx`
- Create: `src/app/(dashboard)/email-center/reports/reports-client.tsx`
- Modify: `src/app/(dashboard)/email-center/email-center.css` (append), `src/app/(dashboard)/email-center/tab-rail.tsx` (drop Reports soon pill)

- [ ] **Step 1: Server page (loads admin flag + user list)**

```tsx
// src/app/(dashboard)/email-center/reports/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function EmailCenterReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true },
  });
  if (!me) redirect("/login");
  const isAdmin = ADMIN_ROLES.includes(me.role);
  const users = isAdmin
    ? await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  return <ReportsClient me={{ id: me.id, name: me.name }} isAdmin={isAdmin} users={users} />;
}
```

- [ ] **Step 2: Client dashboard (stat cards + trend bars + top urls)**

```tsx
// src/app/(dashboard)/email-center/reports/reports-client.tsx
"use client";

/**
 * Email Center reports overview: headline rate cards, a daily send-volume bar
 * chart (pure CSS, no chart lib), and a top-clicked-URLs table. Admins get a
 * date-range + user filter; non-admins see only their own numbers.
 */
import { useCallback, useEffect, useState } from "react";

interface Overview {
  days: number;
  totals: {
    total: number; delivered: number; uniqueOpens: number; uniqueClicks: number;
    bounced: number; complained: number; unsubscribed: number; failed: number;
  };
  rates: {
    deliveryRate: number; openRate: number; clickRate: number; clickToOpenRate: number;
    bounceRate: number; complaintRate: number; unsubscribeRate: number;
  };
  trend: Array<{ day: string; count: number }>;
  topUrls: Array<{ url: string; count: number }>;
}

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

export function ReportsClient({
  me, isAdmin, users,
}: {
  me: { id: string; name: string };
  isAdmin: boolean;
  users: { id: string; name: string }[];
}) {
  const [days, setDays] = useState(30);
  const [viewUser, setViewUser] = useState<string>(isAdmin ? "all" : me.id);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ days: String(days) });
    if (isAdmin && viewUser !== "all") qs.set("user", viewUser);
    const res = await fetch(`/api/email-center/reports/overview?${qs}`);
    const json = await res.json().catch(() => null);
    setData(res.ok ? json : null);
    setLoading(false);
  }, [days, viewUser, isAdmin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load flips loading before fetching, matching the app's inbox pattern
    void load();
  }, [load]);

  const maxTrend = data ? Math.max(1, ...data.trend.map((t) => t.count)) : 1;

  const cards = data
    ? [
        { label: "Sent", value: String(data.totals.total) },
        { label: "Delivery rate", value: `${data.rates.deliveryRate}%` },
        { label: "Open rate", value: `${data.rates.openRate}%` },
        { label: "Click rate", value: `${data.rates.clickRate}%` },
        { label: "Click-to-open", value: `${data.rates.clickToOpenRate}%` },
        { label: "Bounce rate", value: `${data.rates.bounceRate}%` },
        { label: "Unsubscribes", value: String(data.totals.unsubscribed) },
        { label: "Complaints", value: String(data.totals.complained) },
      ]
    : [];

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Reports</h1>
          <p className="ec-flows-sub">Delivery, open, and click performance across your email.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin ? (
            <select className="ec-select ec-select-sm" value={viewUser} onChange={(e) => setViewUser(e.target.value)}>
              <option value="all">All users</option>
              <option value={me.id}>My email</option>
              {users.filter((u) => u.id !== me.id).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          ) : null}
          <select className="ec-select ec-select-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((r) => (
              <option key={r.days} value={r.days}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="ec-stat-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ec-skel" style={{ height: 74 }} />
          ))}
        </div>
      ) : !data || data.totals.total === 0 ? (
        <div className="ec-empty" style={{ paddingTop: 50 }}>
          <div className="ec-empty-title">No email activity yet</div>
          <div className="ec-empty-sub">Once campaigns and flows send mail, performance shows up here.</div>
        </div>
      ) : (
        <>
          <div className="ec-stat-grid">
            {cards.map((c) => (
              <div key={c.label} className="ec-stat-card">
                <div className="ec-stat-value">{c.value}</div>
                <div className="ec-stat-label">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="ec-report-block">
            <div className="ec-report-block-title">Daily send volume</div>
            <div className="ec-trend">
              {data.trend.map((t) => (
                <div key={t.day} className="ec-trend-col" title={`${t.day}: ${t.count}`}>
                  <div className="ec-trend-bar" style={{ height: `${Math.round((t.count / maxTrend) * 100)}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="ec-report-block">
            <div className="ec-report-block-title">Top clicked links</div>
            {data.topUrls.length === 0 ? (
              <div className="ec-empty-sub" style={{ paddingLeft: 2 }}>No clicks recorded yet.</div>
            ) : (
              <div className="ec-flows-list" style={{ maxWidth: 720 }}>
                {data.topUrls.map((u) => (
                  <div key={u.url} className="ec-flow-row">
                    <span className="ec-flow-main" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.url}</span>
                    <span className="ec-pill ec-pill-neutral">{u.count} clicks</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Append CSS**

Append to `email-center.css`:

```css
/* ---------- Reports ---------- */

.ec-report-block {
  max-width: 920px;
  margin-top: 20px;
}

.ec-report-block-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--ec-ink);
  margin-bottom: 10px;
}

.ec-trend {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 120px;
  background: #ffffff;
  border: 1px solid var(--ec-border);
  border-radius: 12px;
  padding: 12px;
  box-shadow: var(--ec-shadow);
}

.ec-trend-col {
  flex: 1;
  min-width: 2px;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.ec-trend-bar {
  width: 100%;
  min-height: 2px;
  background: var(--ec-ink);
  border-radius: 2px 2px 0 0;
  transition: background 0.15s ease;
}

.ec-trend-col:hover .ec-trend-bar {
  background: var(--ec-lime);
}
```

- [ ] **Step 4: Rail - remove `soon: "1c"` from ONLY the Reports entry.**

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "email-center/reports" || echo CLEAN`; dev compile check on `/email-center/reports` (307 ok).

```bash
git add "src/app/(dashboard)/email-center"
git commit -m "Reports: overview dashboard with rate cards, trend, top links"
```

---

### Task 6: Flow report drill-down

**Files:**
- Create: `src/app/(dashboard)/email-center/flows/[id]/report/page.tsx`
- Modify: `src/app/(dashboard)/email-center/flows/flows-client.tsx` (add a "Report" link per row)

- [ ] **Step 1: Flow report server page (funnel + recent sends)**

```tsx
// src/app/(dashboard)/email-center/flows/[id]/report/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { computeRates, type MessageAgg } from "@/lib/email/reports";

export const dynamic = "force-dynamic";

export default async function FlowReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flow = await prisma.flow.findUnique({ where: { id }, select: { id: true, name: true, entityType: true } });
  if (!flow) notFound();

  const msgWhere = { flowId: id, direction: "OUTBOUND" } as const;
  const [total, delivered, uniqueOpens, uniqueClicks, byStatus, runCount, recent] = await Promise.all([
    prisma.emailMessage.count({ where: msgWhere }),
    prisma.emailMessage.count({ where: { ...msgWhere, deliveredAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...msgWhere, openedAt: { not: null } } }),
    prisma.emailMessage.count({ where: { ...msgWhere, firstClickedAt: { not: null } } }),
    prisma.emailMessage.groupBy({ by: ["status"], where: msgWhere, _count: true }),
    prisma.flowRun.count({ where: { flowId: id } }),
    prisma.emailMessage.findMany({
      where: msgWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, toAddresses: true, status: true, openCount: true, clickCount: true, createdAt: true },
    }),
  ]);
  const sc = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const agg: MessageAgg = { total, delivered, uniqueOpens, uniqueClicks, bounced: sc("BOUNCED"), complained: sc("COMPLAINED"), unsubscribed: 0, failed: sc("FAILED") };
  const rates = computeRates(agg);
  const stats = [
    { label: "Runs", value: String(runCount) },
    { label: "Emails sent", value: String(total) },
    { label: "Delivery rate", value: `${rates.deliveryRate}%` },
    { label: "Open rate", value: `${rates.openRate}%` },
    { label: "Click rate", value: `${rates.clickRate}%` },
    { label: "Bounce rate", value: `${rates.bounceRate}%` },
  ];

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">{flow.name}</h1>
          <p className="ec-flows-sub">Flow performance · {flow.entityType} automation</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="ec-btn ec-btn-ghost" href={`/automation/flows/${flow.id}`}>Edit</Link>
          <Link className="ec-btn ec-btn-ghost" href="/email-center/flows">Back</Link>
        </div>
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
        {recent.length === 0 ? (
          <div className="ec-flow-row"><span className="ec-flow-main" style={{ color: "var(--ec-faint)" }}>No emails sent by this flow yet.</span></div>
        ) : recent.map((m) => (
          <div key={m.id} className="ec-flow-row">
            <span className="ec-flow-main" style={{ fontSize: 13 }}>{m.toAddresses}</span>
            {m.openCount > 0 ? <span className="ec-pill ec-pill-green">{m.openCount} opens</span> : null}
            {m.clickCount > 0 ? <span className="ec-pill ec-pill-green">{m.clickCount} clicks</span> : null}
            <span className="ec-flow-stat">{new Date(m.createdAt).toLocaleDateString()}</span>
            <span className={`ec-pill ${m.status === "FAILED" || m.status === "BOUNCED" ? "ec-pill-danger" : "ec-pill-neutral"}`}>{m.status.toLowerCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the Report link to the flows list**

In `src/app/(dashboard)/email-center/flows/flows-client.tsx`, in the `.ec-flow-row` for each flow (after the run-count stat, before or after the Live/Draft pill), add:

```tsx
<Link href={`/email-center/flows/${f.id}/report`} className="ec-btn ec-btn-ghost" style={{ padding: "4px 12px" }}>
  Report
</Link>
```

(`Link` is already imported in that file.)

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "flows/\[id\]/report|flows-client" || echo CLEAN`; dev compile check.

```bash
git add "src/app/(dashboard)/email-center/flows"
git commit -m "Reports: per-flow drill-down with funnel stats and recent sends"
```

---

### Task 7: Per-record Email Activity panel

**Files:**
- Create: `src/app/api/email-center/reports/record-activity/route.ts`
- Create: `src/components/email/record-email-activity.tsx`
- Modify: `src/components/leads/lead-detail-tabs.tsx` (drop the panel into the record view)

- [ ] **Step 1: Record activity API**

```typescript
// src/app/api/email-center/reports/record-activity/route.ts
/**
 * GET /api/email-center/reports/record-activity?entity=lead|account|contact&id=<id>
 *
 * Returns every email tied to the record with its open/click status and source
 * (inbox, campaign name, or flow name). Used by the Email Activity panel on
 * record detail pages. Gated by Email.Send; record access is already gated by
 * the record page itself.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity");
  const id = url.searchParams.get("id");
  if (!id || !entity) return NextResponse.json({ error: "entity and id required" }, { status: 400 });

  const where =
    entity === "account" ? { accountId: id } :
    entity === "contact" ? { contactId: id } :
    { leadId: id };

  const messages = await prisma.emailMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, direction: true, subject: true, status: true, toAddresses: true, fromAddress: true,
      openCount: true, clickCount: true, createdAt: true, sentAt: true,
      massEmail: { select: { name: true } },
      flow: { select: { name: true } },
    },
  });

  return NextResponse.json({
    items: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      subject: m.subject || "(no subject)",
      status: m.status,
      counterparty: m.direction === "INBOUND" ? m.fromAddress : m.toAddresses,
      openCount: m.openCount,
      clickCount: m.clickCount,
      at: (m.sentAt ?? m.createdAt).toISOString(),
      source: m.massEmail?.name ? `Campaign: ${m.massEmail.name}` : m.flow?.name ? `Flow: ${m.flow.name}` : m.direction === "INBOUND" ? "Inbound" : "Direct",
    })),
  });
}
```

Note: `EmailMessage` must expose `flow` and `massEmail` relations. `massEmail` already exists (relation "MassEmailMessages"). For `flow`, `flowId` is a plain scalar (no relation) from the Flows build; add a nullable relation in this task's schema touch: in `model EmailMessage` add `flow Flow? @relation("FlowEmails", fields: [flowId], references: [id])` and on `model Flow` add `emails EmailMessage[] @relation("FlowEmails")`. Then re-run `DATABASE_URL=... npx prisma db push && npx prisma generate`. (flowId stays populated as before; adding the relation does not change existing data.)

- [ ] **Step 2: The panel component**

```tsx
// src/components/email/record-email-activity.tsx
"use client";

/**
 * Email Activity panel for record detail pages (lead/account/contact). Lists
 * every email on the record with open/click status and its source. Self-loads
 * from /api/email-center/reports/record-activity.
 */
import { useEffect, useState } from "react";

interface Item {
  id: string;
  direction: string;
  subject: string;
  status: string;
  counterparty: string;
  openCount: number;
  clickCount: number;
  at: string;
  source: string;
}

export function RecordEmailActivity({ entity, id }: { entity: "lead" | "account" | "contact"; id: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/email-center/reports/record-activity?entity=${entity}&id=${id}`)
      .then((r) => r.json())
      .then((d) => { if (active) { setItems(d.items ?? []); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [entity, id]);

  if (loading) return <div style={{ padding: 12, fontSize: 13, color: "#706e6b" }}>Loading email activity...</div>;
  if (items.length === 0) return <div style={{ padding: 12, fontSize: 13, color: "#706e6b" }}>No email activity yet.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((m) => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid #e6e6e3", borderRadius: 8, background: "#fff" }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.subject}</span>
            <span style={{ display: "block", fontSize: 11, color: "#9c9c97" }}>{m.direction === "INBOUND" ? "From" : "To"} {m.counterparty} · {m.source}</span>
          </span>
          {m.openCount > 0 ? <span style={{ fontSize: 11, fontWeight: 600, color: "#0e5c31" }}>{m.openCount} opens</span> : null}
          {m.clickCount > 0 ? <span style={{ fontSize: 11, fontWeight: 600, color: "#0e5c31" }}>{m.clickCount} clicks</span> : null}
          <span style={{ fontSize: 11, color: "#706e6b" }}>{new Date(m.at).toLocaleDateString()}</span>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "lowercase", color: m.status === "FAILED" || m.status === "BOUNCED" ? "#b3261e" : "#6e6e6a" }}>{m.status.toLowerCase()}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Mount it on the lead detail page**

In `src/components/leads/lead-detail-tabs.tsx`: add `import { RecordEmailActivity } from "@/components/email/record-email-activity";`. Add a new tab entry `{ value: "emails", label: "Emails" }` to the tabs array (line ~396), and a matching `<TabsContent value="emails">` block that renders `<RecordEmailActivity entity="lead" id={lead.id} />` wrapped in the same card/section markup the sibling tabs use (mirror the "notes" or "campaigns" TabsContent structure). Keep the file's existing styling conventions.

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "record-activity|record-email-activity|lead-detail-tabs" || echo CLEAN`; `npx vitest run` green. If the flow relation push is needed, run the db push from Step 1.

```bash
git add src/app/api/email-center/reports/record-activity src/components/email/record-email-activity.tsx src/components/leads/lead-detail-tabs.tsx prisma/schema.prisma
git commit -m "Reports: per-record Email Activity panel with source attribution"
```

---

## PART B - DOMAIN HEALTH

### Task 8: DomainHealthSnapshot schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model**

```prisma
// Point-in-time domain deliverability health. Refreshed by the domain-health
// cron and on-demand via the "Re-check now" button. Keeps history for trends.
model DomainHealthSnapshot {
  id            String   @id @default(cuid())
  domain        String
  // DNS auth: each is PASS | FAIL | UNKNOWN
  spf           String   @default("UNKNOWN")
  dkim          String   @default("UNKNOWN")
  dmarc         String   @default("UNKNOWN")
  spfRecord     String?
  dmarcRecord   String?
  // Reputation over the trailing window, and the 0-100 score.
  bounceRate    Float    @default(0)
  complaintRate Float    @default(0)
  openRate      Float    @default(0)
  score         Int      @default(0)
  // Blacklist: JSON array of { zone, listed: bool }.
  blacklists    Json     @default("[]")
  createdAt     DateTime @default(now())

  @@index([domain, createdAt])
}
```

- [ ] **Step 2: Push + generate + commit**

Run: `npx prisma validate && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_local" npx prisma db push --accept-data-loss && npx prisma generate`

```bash
git add prisma/schema.prisma
git commit -m "Domain Health: DomainHealthSnapshot model"
```

---

### Task 9: DNS + DNSBL check lib (TDD the pure parts)

**Files:**
- Create: `src/lib/email/domain-dns.ts`
- Test: `tests/domain-dns.test.ts`

- [ ] **Step 1: Failing tests for the pure parsers**

```typescript
// tests/domain-dns.test.ts
import { describe, it, expect } from "vitest";
import { classifySpf, classifyDmarc, reverseIpForDnsbl } from "@/lib/email/domain-dns";

describe("classifySpf", () => {
  it("PASS when a v=spf1 record exists", () => {
    expect(classifySpf(["v=spf1 include:_spf.resend.com ~all"])).toEqual({ status: "PASS", record: "v=spf1 include:_spf.resend.com ~all" });
  });
  it("FAIL when TXT records exist but none are spf", () => {
    expect(classifySpf(["some-verification=abc"]).status).toBe("FAIL");
  });
  it("UNKNOWN when there are no records (lookup failure)", () => {
    expect(classifySpf(null).status).toBe("UNKNOWN");
  });
});

describe("classifyDmarc", () => {
  it("PASS on a policy of quarantine or reject", () => {
    expect(classifyDmarc(["v=DMARC1; p=reject"]).status).toBe("PASS");
    expect(classifyDmarc(["v=DMARC1; p=quarantine"]).status).toBe("PASS");
  });
  it("FAIL on p=none (present but not enforcing)", () => {
    expect(classifyDmarc(["v=DMARC1; p=none"]).status).toBe("FAIL");
  });
  it("UNKNOWN when absent", () => {
    expect(classifyDmarc(null).status).toBe("UNKNOWN");
  });
});

describe("reverseIpForDnsbl", () => {
  it("reverses the octets for a DNSBL query", () => {
    expect(reverseIpForDnsbl("1.2.3.4", "zen.spamhaus.org")).toBe("4.3.2.1.zen.spamhaus.org");
  });
  it("returns null for a non-ipv4 string", () => {
    expect(reverseIpForDnsbl("not-an-ip", "zen.spamhaus.org")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

Run: `npx vitest run tests/domain-dns.test.ts`

- [ ] **Step 3: Implement**

```typescript
// src/lib/email/domain-dns.ts
/**
 * DNS-based deliverability checks. Pure classifiers are unit-tested; the async
 * lookups wrap node:dns/promises and return UNKNOWN on any resolver error so a
 * flaky network never reports a false PASS/FAIL.
 */
import { resolveTxt, resolve4, resolve as dnsResolve } from "node:dns/promises";

export type AuthStatus = "PASS" | "FAIL" | "UNKNOWN";
export interface AuthResult { status: AuthStatus; record?: string | null }

function flattenTxt(records: string[][] | null): string[] | null {
  if (!records) return null;
  return records.map((chunks) => chunks.join(""));
}

export function classifySpf(txt: string[] | null): AuthResult {
  if (!txt) return { status: "UNKNOWN" };
  const spf = txt.find((r) => r.toLowerCase().startsWith("v=spf1"));
  return spf ? { status: "PASS", record: spf } : { status: "FAIL", record: null };
}

export function classifyDmarc(txt: string[] | null): AuthResult {
  if (!txt) return { status: "UNKNOWN" };
  const dmarc = txt.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
  if (!dmarc) return { status: "FAIL", record: null };
  const policy = /p=\s*(none|quarantine|reject)/i.exec(dmarc)?.[1]?.toLowerCase();
  return { status: policy === "quarantine" || policy === "reject" ? "PASS" : "FAIL", record: dmarc };
}

export function reverseIpForDnsbl(ip: string, zone: string): string | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
  if (!m) return null;
  return `${m[4]}.${m[3]}.${m[2]}.${m[1]}.${zone}`;
}

async function txtOrNull(host: string): Promise<string[] | null> {
  try {
    return flattenTxt((await resolveTxt(host)) as unknown as string[][]);
  } catch {
    return null;
  }
}

export async function checkSpf(domain: string): Promise<AuthResult> {
  return classifySpf(await txtOrNull(domain));
}

export async function checkDmarc(domain: string): Promise<AuthResult> {
  return classifyDmarc(await txtOrNull(`_dmarc.${domain}`));
}

/**
 * DKIM: we cannot enumerate selectors generically, so we probe the given
 * selectors (Resend uses "resend"). PASS if any selector has a TXT/CNAME.
 */
export async function checkDkim(domain: string, selectors: string[] = ["resend"]): Promise<AuthResult> {
  for (const sel of selectors) {
    const host = `${sel}._domainkey.${domain}`;
    const txt = await txtOrNull(host);
    if (txt && txt.length > 0) return { status: "PASS", record: `${sel}._domainkey` };
    try {
      const cname = await dnsResolve(host, "CNAME");
      if (cname && cname.length > 0) return { status: "PASS", record: `${sel}._domainkey (CNAME)` };
    } catch {
      // try next selector
    }
  }
  return { status: "FAIL", record: null };
}

export interface BlacklistResult { zone: string; listed: boolean }

const DEFAULT_ZONES = ["zen.spamhaus.org", "b.barracudacentral.org", "bl.spamcop.net"];

/** Resolve the sending IP against each DNSBL zone. An A answer means listed. */
export async function checkBlacklists(ip: string | null, zones: string[] = DEFAULT_ZONES): Promise<BlacklistResult[]> {
  if (!ip) return zones.map((zone) => ({ zone, listed: false }));
  const out: BlacklistResult[] = [];
  for (const zone of zones) {
    const query = reverseIpForDnsbl(ip, zone);
    if (!query) { out.push({ zone, listed: false }); continue; }
    try {
      const a = await resolve4(query);
      out.push({ zone, listed: a.length > 0 });
    } catch {
      // NXDOMAIN (not listed) or resolver error -> treat as not listed
      out.push({ zone, listed: false });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests, PASS. Full suite green.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/domain-dns.ts tests/domain-dns.test.ts
git commit -m "Domain Health: SPF/DKIM/DMARC classifiers and DNSBL checks"
```

---

### Task 10: Reputation scoring lib (TDD)

**Files:**
- Create: `src/lib/email/domain-reputation.ts`
- Test: `tests/domain-reputation.test.ts`

- [ ] **Step 1: Failing tests**

```typescript
// tests/domain-reputation.test.ts
import { describe, it, expect } from "vitest";
import { healthScore, grade } from "@/lib/email/domain-reputation";

describe("healthScore", () => {
  it("is 100 for perfect auth, zero bounces/complaints, healthy opens", () => {
    expect(healthScore({
      spf: "PASS", dkim: "PASS", dmarc: "PASS",
      bounceRate: 0, complaintRate: 0, openRate: 40, blacklisted: 0,
    })).toBe(100);
  });
  it("penalizes failed auth, high bounce/complaint, and blacklisting", () => {
    const s = healthScore({
      spf: "FAIL", dkim: "PASS", dmarc: "FAIL",
      bounceRate: 8, complaintRate: 0.5, openRate: 5, blacklisted: 1,
    });
    expect(s).toBeLessThan(50);
    expect(s).toBeGreaterThanOrEqual(0);
  });
  it("clamps to the 0-100 range", () => {
    expect(healthScore({ spf: "FAIL", dkim: "FAIL", dmarc: "FAIL", bounceRate: 100, complaintRate: 100, openRate: 0, blacklisted: 5 })).toBe(0);
  });
});

describe("grade", () => {
  it("labels score bands", () => {
    expect(grade(95)).toBe("Excellent");
    expect(grade(80)).toBe("Good");
    expect(grade(60)).toBe("Fair");
    expect(grade(30)).toBe("Poor");
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

Run: `npx vitest run tests/domain-reputation.test.ts`

- [ ] **Step 3: Implement**

```typescript
// src/lib/email/domain-reputation.ts
/**
 * Deliverability health score (0-100) from our own send data plus DNS auth and
 * blacklist status. Weighting: auth 30, bounce 25, complaint 25, blacklist 15,
 * engagement 5. All inputs are already-computed values; this module is pure.
 */
import type { AuthStatus } from "./domain-dns";

export interface ScoreInput {
  spf: AuthStatus;
  dkim: AuthStatus;
  dmarc: AuthStatus;
  bounceRate: number; // percent
  complaintRate: number; // percent
  openRate: number; // percent
  blacklisted: number; // count of zones listing us
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function healthScore(i: ScoreInput): number {
  // Auth: 10 points each, PASS=full, UNKNOWN=half, FAIL=0.
  const authPts = (s: AuthStatus) => (s === "PASS" ? 10 : s === "UNKNOWN" ? 5 : 0);
  const auth = authPts(i.spf) + authPts(i.dkim) + authPts(i.dmarc); // 0..30

  // Bounce: 25 at 0%, linearly to 0 at 10%+.
  const bounce = clamp(25 * (1 - i.bounceRate / 10), 0, 25);
  // Complaint: 25 at 0%, to 0 at 0.5%+ (spam complaints matter a lot).
  const complaint = clamp(25 * (1 - i.complaintRate / 0.5), 0, 25);
  // Blacklist: 15 if clean, minus 8 per listing.
  const blacklist = clamp(15 - i.blacklisted * 8, 0, 15);
  // Engagement: 5 at 20%+ open rate, scaled down.
  const engagement = clamp(5 * (i.openRate / 20), 0, 5);

  return Math.round(clamp(auth + bounce + complaint + blacklist + engagement, 0, 100));
}

export function grade(score: number): "Excellent" | "Good" | "Fair" | "Poor" {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}
```

- [ ] **Step 4: Run tests, PASS. Full suite green.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/domain-reputation.ts tests/domain-reputation.test.ts
git commit -m "Domain Health: 0-100 reputation score and grade bands"
```

---

### Task 11: Domain Health snapshot builder + API + cron

**Files:**
- Create: `src/lib/email/domain-health.ts`
- Create: `src/app/api/email-center/domain-health/route.ts` (GET latest + POST re-check)
- Create: `src/app/api/email-center/domain-health/refresh/route.ts` (cron)

- [ ] **Step 1: The snapshot builder**

```typescript
// src/lib/email/domain-health.ts
/**
 * Builds a DomainHealthSnapshot: runs the DNS/DNSBL checks, computes reputation
 * from the trailing 30 days of sends for the domain, scores it, and persists a
 * row. Callers: the cron (daily) and the "Re-check now" button.
 */
import { prisma } from "@/lib/prisma";
import { checkSpf, checkDkim, checkDmarc, checkBlacklists } from "./domain-dns";
import { healthScore, type ScoreInput } from "./domain-reputation";

/** The sending domain, from EMAIL_FROM (e.g. "Coastal Debt <no-reply@coastaldebt.com>" -> coastaldebt.com). */
export function sendingDomain(): string {
  const from = process.env.EMAIL_FROM ?? "no-reply@coastaldebt.com";
  const m = /@([a-z0-9.-]+)/i.exec(from);
  return (m?.[1] ?? "coastaldebt.com").toLowerCase();
}

export async function buildDomainHealthSnapshot(): Promise<{ id: string; score: number }> {
  const domain = sendingDomain();
  const since = new Date(Date.now() - 30 * 864e5);

  const [spf, dkim, dmarc, blacklists, total, bounced, complained, delivered, opened] = await Promise.all([
    checkSpf(domain),
    checkDkim(domain),
    checkDmarc(domain),
    checkBlacklists(process.env.SENDING_IP ?? null),
    prisma.emailMessage.count({ where: { direction: "OUTBOUND", createdAt: { gte: since } } }),
    prisma.emailMessage.count({ where: { direction: "OUTBOUND", createdAt: { gte: since }, status: "BOUNCED" } }),
    prisma.emailMessage.count({ where: { direction: "OUTBOUND", createdAt: { gte: since }, status: "COMPLAINED" } }),
    prisma.emailMessage.count({ where: { direction: "OUTBOUND", createdAt: { gte: since }, deliveredAt: { not: null } } }),
    prisma.emailMessage.count({ where: { direction: "OUTBOUND", createdAt: { gte: since }, openedAt: { not: null } } }),
  ]);

  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
  const bounceRate = pct(bounced, total);
  const complaintRate = pct(complained, total);
  const openRate = pct(opened, delivered);
  const listedCount = blacklists.filter((b) => b.listed).length;

  const scoreInput: ScoreInput = {
    spf: spf.status, dkim: dkim.status, dmarc: dmarc.status,
    bounceRate, complaintRate, openRate, blacklisted: listedCount,
  };
  const score = healthScore(scoreInput);

  const snap = await prisma.domainHealthSnapshot.create({
    data: {
      domain,
      spf: spf.status, dkim: dkim.status, dmarc: dmarc.status,
      spfRecord: spf.record ?? null, dmarcRecord: dmarc.record ?? null,
      bounceRate, complaintRate, openRate, score,
      blacklists: blacklists as unknown as object,
    },
    select: { id: true, score: true },
  });
  return snap;
}
```

- [ ] **Step 2: GET latest + POST re-check API**

```typescript
// src/app/api/email-center/domain-health/route.ts
/**
 * GET  - latest snapshot + a short history for the trend.
 * POST - "Re-check now": builds a fresh snapshot synchronously (admins only).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { buildDomainHealthSnapshot, sendingDomain } from "@/lib/email/domain-health";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export async function GET() {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const domain = sendingDomain();
  const [latest, history] = await Promise.all([
    prisma.domainHealthSnapshot.findFirst({ where: { domain }, orderBy: { createdAt: "desc" } }),
    prisma.domainHealthSnapshot.findMany({ where: { domain }, orderBy: { createdAt: "desc" }, take: 30, select: { score: true, createdAt: true } }),
  ]);
  return NextResponse.json({ domain, latest, history: history.reverse() });
}

export async function POST() {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!ADMIN_ROLES.includes(r.session.role)) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const snap = await buildDomainHealthSnapshot();
  return NextResponse.json({ ok: true, ...snap });
}
```

- [ ] **Step 3: Cron refresh endpoint**

```typescript
// src/app/api/email-center/domain-health/refresh/route.ts
/**
 * POST /api/email-center/domain-health/refresh
 * Authorization: Bearer ${FLOW_POLL_SECRET} (or PROCESSOR_SYNC_SECRET)
 *
 * Builds one snapshot. Call daily from the mini cron (03:00 branch).
 */
import { NextRequest, NextResponse } from "next/server";
import { buildDomainHealthSnapshot } from "@/lib/email/domain-health";

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
  const snap = await buildDomainHealthSnapshot();
  return NextResponse.json({ ok: true, ...snap });
}
```

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "domain-health" || echo CLEAN`; `npx vitest run` green.

Functional (local DB, dev PORT=3021): `curl -X POST http://localhost:3021/api/email-center/domain-health/refresh -H "Authorization: Bearer wrong"` -> 401; with a real secret set in the dev env -> 200 with a score, and a DomainHealthSnapshot row appears (DNS lookups for coastaldebt.com run live; UNKNOWN is acceptable offline). Delete the row after.

```bash
git add src/lib/email/domain-health.ts src/app/api/email-center/domain-health
git commit -m "Domain Health: snapshot builder, latest/recheck API, cron refresh"
```

---

### Task 12: Domain Health UI

**Files:**
- Replace: `src/app/(dashboard)/email-center/domain-health/page.tsx`
- Create: `src/app/(dashboard)/email-center/domain-health/health-client.tsx`
- Modify: `email-center.css` (append), `tab-rail.tsx` (drop Domain Health soon pill)

- [ ] **Step 1: Server page**

```tsx
// src/app/(dashboard)/email-center/domain-health/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { sendingDomain } from "@/lib/email/domain-health";
import { HealthClient } from "./health-client";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function DomainHealthPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const domain = sendingDomain();
  const latest = await prisma.domainHealthSnapshot.findFirst({ where: { domain }, orderBy: { createdAt: "desc" } });
  return (
    <HealthClient
      domain={domain}
      isAdmin={ADMIN_ROLES.includes(me?.role ?? "")}
      initial={latest ? {
        spf: latest.spf, dkim: latest.dkim, dmarc: latest.dmarc,
        spfRecord: latest.spfRecord, dmarcRecord: latest.dmarcRecord,
        bounceRate: latest.bounceRate, complaintRate: latest.complaintRate, openRate: latest.openRate,
        score: latest.score, blacklists: (latest.blacklists as Array<{ zone: string; listed: boolean }>) ?? [],
        createdAt: latest.createdAt.toISOString(),
      } : null}
    />
  );
}
```

- [ ] **Step 2: Client**

```tsx
// src/app/(dashboard)/email-center/domain-health/health-client.tsx
"use client";

/**
 * Domain Health: score gauge, SPF/DKIM/DMARC pass-fail with the records to fix,
 * reputation rates, and blacklist status. Admins can trigger a live re-check.
 */
import { useState } from "react";

interface Snapshot {
  spf: string; dkim: string; dmarc: string;
  spfRecord: string | null; dmarcRecord: string | null;
  bounceRate: number; complaintRate: number; openRate: number;
  score: number; blacklists: Array<{ zone: string; listed: boolean }>;
  createdAt: string;
}

function grade(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

function AuthRow({ label, status, record, fixHint }: { label: string; status: string; record: string | null; fixHint: string }) {
  const cls = status === "PASS" ? "ec-pill-live" : status === "UNKNOWN" ? "ec-pill-amber" : "ec-pill-danger";
  return (
    <div className="ec-flow-row">
      <span className="ec-flow-main">
        <span className="ec-flow-name">{label}</span>
        <span className="ec-flow-desc">{status === "PASS" ? (record ?? "Configured") : status === "UNKNOWN" ? "Could not resolve (offline or missing)" : fixHint}</span>
      </span>
      <span className={`ec-pill ${cls}`}>{status.toLowerCase()}</span>
    </div>
  );
}

export function HealthClient({ domain, isAdmin, initial }: { domain: string; isAdmin: boolean; initial: Snapshot | null }) {
  const [snap, setSnap] = useState<Snapshot | null>(initial);
  const [busy, setBusy] = useState(false);

  async function recheck() {
    setBusy(true);
    const res = await fetch("/api/email-center/domain-health", { method: "POST" });
    if (res.ok) {
      const fresh = await fetch("/api/email-center/domain-health").then((r) => r.json()).catch(() => null);
      if (fresh?.latest) {
        const l = fresh.latest;
        setSnap({
          spf: l.spf, dkim: l.dkim, dmarc: l.dmarc, spfRecord: l.spfRecord, dmarcRecord: l.dmarcRecord,
          bounceRate: l.bounceRate, complaintRate: l.complaintRate, openRate: l.openRate,
          score: l.score, blacklists: l.blacklists ?? [], createdAt: l.createdAt,
        });
      }
    }
    setBusy(false);
  }

  const listed = snap?.blacklists.filter((b) => b.listed) ?? [];

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Domain Health</h1>
          <p className="ec-flows-sub">Deliverability for {domain}{snap ? ` · checked ${new Date(snap.createdAt).toLocaleString()}` : ""}</p>
        </div>
        {isAdmin ? (
          <button className="ec-btn ec-btn-primary" disabled={busy} onClick={() => void recheck()}>
            {busy ? "Checking..." : "Re-check now"}
          </button>
        ) : null}
      </div>

      {!snap ? (
        <div className="ec-empty" style={{ paddingTop: 50 }}>
          <div className="ec-empty-title">No health check yet</div>
          <div className="ec-empty-sub">{isAdmin ? "Run the first check with Re-check now." : "An admin can run the first check."}</div>
        </div>
      ) : (
        <>
          <div className="ec-health-top">
            <div className="ec-health-gauge">
              <div className="ec-health-score">{snap.score}</div>
              <div className="ec-health-grade">{grade(snap.score)}</div>
            </div>
            <div className="ec-stat-grid" style={{ flex: 1 }}>
              <div className="ec-stat-card"><div className="ec-stat-value">{snap.bounceRate}%</div><div className="ec-stat-label">Bounce rate</div></div>
              <div className="ec-stat-card"><div className="ec-stat-value">{snap.complaintRate}%</div><div className="ec-stat-label">Complaint rate</div></div>
              <div className="ec-stat-card"><div className="ec-stat-value">{snap.openRate}%</div><div className="ec-stat-label">Open rate (30d)</div></div>
              <div className="ec-stat-card"><div className="ec-stat-value">{listed.length === 0 ? "Clean" : String(listed.length)}</div><div className="ec-stat-label">Blacklists</div></div>
            </div>
          </div>

          <div className="ec-report-block">
            <div className="ec-report-block-title">Authentication</div>
            <div className="ec-flows-list" style={{ maxWidth: 720 }}>
              <AuthRow label="SPF" status={snap.spf} record={snap.spfRecord} fixHint={`Add a TXT record on ${domain}: v=spf1 include:_spf.resend.com ~all`} />
              <AuthRow label="DKIM" status={snap.dkim} record={null} fixHint="Add the Resend DKIM CNAME records shown in the Resend dashboard." />
              <AuthRow label="DMARC" status={snap.dmarc} record={snap.dmarcRecord} fixHint={`Add a TXT record on _dmarc.${domain}: v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`} />
            </div>
          </div>

          <div className="ec-report-block">
            <div className="ec-report-block-title">Blacklists</div>
            <div className="ec-flows-list" style={{ maxWidth: 720 }}>
              {snap.blacklists.map((b) => (
                <div key={b.zone} className="ec-flow-row">
                  <span className="ec-flow-main" style={{ fontSize: 13 }}>{b.zone}</span>
                  <span className={`ec-pill ${b.listed ? "ec-pill-danger" : "ec-pill-live"}`}>{b.listed ? "listed" : "clean"}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Append CSS + drop the rail pill**

Append to email-center.css:

```css
/* ---------- Domain Health ---------- */

.ec-health-top {
  display: flex;
  gap: 16px;
  align-items: stretch;
  max-width: 920px;
}

.ec-health-gauge {
  width: 160px;
  flex-shrink: 0;
  background: var(--ec-forest);
  color: #fff;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 18px;
  box-shadow: var(--ec-shadow);
}

.ec-health-score {
  font-size: 44px;
  font-weight: 800;
  line-height: 1;
  color: var(--ec-lime);
}

.ec-health-grade {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(244, 247, 242, 0.7);
  margin-top: 6px;
}
```

In tab-rail.tsx remove `soon: "1c"` from the Domain Health entry.

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "domain-health" || echo CLEAN`; dev compile check.

```bash
git add "src/app/(dashboard)/email-center"
git commit -m "Domain Health: score gauge, auth checks, blacklist UI with re-check"
```

---

### Task 13: Full verification + E2E

- [ ] **Step 1: Suite + build + lint**

Run: `npx vitest run` (expect the new events/reports/domain-dns/domain-reputation tests green), `npm run build`, `npx eslint "src/app/(dashboard)/email-center" src/lib/email src/app/api/email-center 2>&1 | tail -3`.

- [ ] **Step 2: Browser E2E (local DB, PORT=3022, FLOW_POLL_SECRET=healthtest)**

Seed (throwaway tsx, reuse the SUPER_ADMIN + System_Administrator profile + bcrypt pattern): an admin user; a small MassEmail (SENT) with ~6 EmailMessage children spanning statuses (some DELIVERED, some OPENED with openedAt+openCount, some CLICKED with firstClickedAt, one BOUNCED); a handful of EmailEvent rows (OPEN/CLICK with urls, denormalized massEmailId+ownerId) so the trend and top-urls populate; a lead with 2-3 EmailMessages for the activity panel; and one flow with flowId-tagged sends.

Then in Playwright:
1. Reports overview: rate cards show non-zero delivery/open/click, the trend bar chart renders, top-clicked-links table lists the seeded urls. As admin, switch the user filter and the 7/30/90 range and confirm the numbers change without error.
2. Flow report: open `/email-center/flows/<id>/report`, funnel stats + recent sends render.
3. Lead Email Activity: open the seeded lead detail page, Emails tab, confirm the panel lists the emails with source attribution and open/click badges.
4. Domain Health: click Re-check now, confirm a score renders (DNS for coastaldebt.com resolves live; if offline, statuses show UNKNOWN which is acceptable), the auth rows + blacklist rows render, and a DomainHealthSnapshot row is created. Also `curl` the refresh cron with a wrong bearer -> 401, right bearer -> 200.
5. Screenshots: reports overview, domain health.
6. Clean up all seeded rows (events, messages, mass email, flow, lead, snapshots, user) + scripts; kill the server; confirm `git status --short` clean.

- [ ] **Step 3: Commit anything outstanding; do NOT push**

Deploy notes for the final report: add a daily POST to `/api/email-center/domain-health/refresh` in the mini cron 03:00 branch (alongside flow/sweep); the reports/domain-health pages need no new env beyond the existing FLOW_POLL_SECRET and EMAIL_FROM (used to derive the sending domain); optional `SENDING_IP` env enables IP-based DNSBL checks (without it, blacklist rows show clean/not-checked).
