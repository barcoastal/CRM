# Email Center Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Flow engine into the Email Center's automation layer: owner-mailbox email sends with threading/attribution/suppression, re-entry safety, an inactivity trigger with sweep, Contact support, and a Klaviyo-style Flows tab.

**Architecture:** Extend (never fork) the existing Flow system: `Flow`/`FlowRun` models, node graph in `src/lib/flow/nodes.ts`, executor in `src/lib/flow/executor.ts`, triggers fired via `src/lib/triggers/runner.ts` (`evaluateAndStartFlows`), WAITING-run poller at `POST /api/flow/poll` (Bearer `FLOW_POLL_SECRET` or `PROCESSOR_SYNC_SECRET` fallback). Email sends reuse the Phase 1a threading conventions from `src/lib/email/threading.ts`.

**Tech Stack:** Next.js App Router, Prisma/Postgres (`prisma db push`, no migrations dir), Resend, vitest (`tests/*.test.ts`, `@` aliased to `./src`).

**Spec:** `docs/superpowers/specs/2026-08-13-email-center-design.md` section 4 (Flows). Deliberately EXCLUDED from this plan (deferred, do not flag as gaps): segment-entry triggers (Segments are Phase 1b and do not exist yet), enroll/unenroll/add-to-campaign action nodes (re-entry policy + triggers cover the 1c need), and a per-node continue-on-failure setting (current halt-on-failure default matches the spec default). Lead-created and stage-changed triggers ALREADY exist (INSERT / UPDATE with triggerOnFieldChanges) and need no work.

**Codebase facts the engineer needs:**
- `model Flow` at prisma/schema.prisma ~line 2740: entityType, triggerEvent (INSERT | UPDATE | INSERT_OR_UPDATE), triggerOnFieldChanges Json, entryCriteria Json, isActive, graph Json, runs FlowRun[].
- `model FlowRun` ~line 2762: status RUNNING | COMPLETED | FAILED | WAITING | CANCELLED, trace Json, scheduledResumeAt, startedAt.
- `src/lib/flow/nodes.ts` (158 lines): NODE_KINDS incl `send_email` (config: templateId, subject, body, toFieldPath), SUPPORTED_ENTITIES = Lead, Opportunity, Account, Case, Task, Event (NO Contact yet), TRIGGER_EVENTS, DEFAULT_NODE_CONFIG, NODE_LABELS, NODE_TONES.
- `src/lib/flow/executor.ts` (487 lines): `execStep` switch handles each node kind; `send_email` case creates a QUEUED EmailMessage (no fromAddress, no ownerId, no threading fields) then `void sendQueuedEmail(id)`. `evaluateAndStartFlows(entityType, event, record, prev?)` filters active flows, gates UPDATE on triggerOnFieldChanges, checks entryCriteria, calls `startFlow`. `walk` treats a step `{ ok: false }` as run FAILED; `{ ok: true }` continues.
- `src/lib/triggers/runner.ts`: FLOW_ENTITY_LABEL already maps `contact: "Contact"`. Trigger wrappers (`triggerCreate`/`triggerUpdate`) are used by lead/account/opportunity disposition routes, inbound web-leads, envelopes, etc.
- Owner fields per entity: Lead.assignedToId, Contact.ownerId, Account.ownerId, Opportunity.assignedToId, Case.ownerId.
- Relation names for activity: Lead.emails/calls/tasks, Contact.emails/tasks, Account.emails/tasks.
- Threading helpers: `normalizeSubject`, `extractEmails`, `normalizeMessageId` in `src/lib/email/threading.ts`. EmailMessage now has threadId/subjectNorm/messageIdHeader/inReplyTo/readAt/ownerId.
- `SuppressionEntry` is a PHONE DNC list; email suppression does NOT exist yet and is created in this plan (Phase 1b unsubscribe will reuse it).
- Resend event webhook: `src/app/api/emails/webhook/resend/route.ts` (read it in Task 2; it maps Resend events to EmailMessage statuses).
- Flow APIs: `src/app/api/flows/route.ts` (75 lines) and `src/app/api/flows/[id]/route.ts` (94 lines). Flow editor UI: `src/components/flow/flow-editor.tsx`, pages under `src/app/(dashboard)/automation/flows/`.
- Email Center UI conventions: `.ec-` classes in `src/app/(dashboard)/email-center/email-center.css` (monochrome Klaviyo style: black rail, white cards, lime accent `--ec-lime`, black primary buttons). The Flows placeholder to replace: `src/app/(dashboard)/email-center/flows/page.tsx`.
- Local DB: `postgresql://postgres:postgres@localhost:5432/crm_local` (repo .env DATABASE_URL is stale sqlite; always override). psql at `/Applications/Postgres.app/Contents/Versions/latest/bin/psql` user `postgres`.
- Do not use em dashes anywhere. Never push to the remote (Bar deploys explicitly).

---

### Task 1: Schema (attribution, re-entry, inactivity, email suppression)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: EmailMessage attribution fields**

In `model EmailMessage`, after the `readAt` line, add:

```prisma
  // Flow attribution: which automation produced this send. Plain keys (no FK)
  // so deleting a flow keeps the send history intact.
  flowId    String?
  flowRunId String?
```

And in the EmailMessage index block add:

```prisma
  @@index([flowId])
```

- [ ] **Step 2: Flow safety + inactivity fields**

In `model Flow`, after the `isActive` line, add:

```prisma
  // Re-entry safety: ALWAYS = a record can start this flow every time the
  // trigger fires; ONCE = only the first time ever; COOLDOWN = wait
  // reentryCooldownDays after the last run before re-entering.
  reentryPolicy       String @default("ALWAYS") // ALWAYS | ONCE | COOLDOWN
  reentryCooldownDays Int    @default(30)
  // For triggerEvent = INACTIVITY: fire when the record has no email/call/task
  // activity in this many days. Evaluated by the /api/flow/sweep cron.
  inactivityDays      Int?
```

- [ ] **Step 3: EmailSuppression model**

Add near `model SuppressionEntry` (~line 467):

```prisma
// Email-channel suppression list (distinct from the phone DNC SuppressionEntry).
// Automated sends (flows, later campaigns) skip these addresses. Fed by the
// Resend webhook on hard bounces/complaints; Phase 1b unsubscribe writes here too.
model EmailSuppression {
  id        String   @id @default(cuid())
  email     String   @unique // stored lowercase
  reason    String // HARD_BOUNCE | COMPLAINT | UNSUBSCRIBE | MANUAL
  source    String? // free text, e.g. "resend-webhook" or "flow:<id>"
  createdAt DateTime @default(now())
}
```

- [ ] **Step 4: Push and generate**

Run: `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_local" npx prisma db push --accept-data-loss && npx prisma generate`
Expected: in sync + client generated. (The only warning should be the new unique on EmailSuppression, an empty table.)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "Flows: email attribution, re-entry policy, inactivity trigger fields, EmailSuppression"
```

---

### Task 2: Email suppression lib + Resend webhook wiring (TDD)

**Files:**
- Create: `src/lib/email/suppression.ts`
- Modify: `src/app/api/emails/webhook/resend/route.ts`
- Test: `tests/email-suppression.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/email-suppression.test.ts
import { describe, it, expect } from "vitest";
import { normalizeEmail, decideSuppression } from "@/lib/email/suppression";

describe("normalizeEmail", () => {
  it("lowercases and trims, extracts bare address from display form", () => {
    expect(normalizeEmail("  Joe <JOE@X.com> ")).toBe("joe@x.com");
    expect(normalizeEmail("PLAIN@X.COM")).toBe("plain@x.com");
    expect(normalizeEmail("")).toBe("");
  });
});

describe("decideSuppression", () => {
  it("maps Resend bounce and complaint events to reasons", () => {
    expect(decideSuppression("email.bounced", { type: "hard" })).toBe("HARD_BOUNCE");
    expect(decideSuppression("email.complained", undefined)).toBe("COMPLAINT");
  });
  it("ignores soft bounces and unrelated events", () => {
    expect(decideSuppression("email.bounced", { type: "soft" })).toBeNull();
    expect(decideSuppression("email.delivered", undefined)).toBeNull();
    expect(decideSuppression("email.opened", undefined)).toBeNull();
  });
  it("treats a bounce without subtype as hard", () => {
    expect(decideSuppression("email.bounced", undefined)).toBe("HARD_BOUNCE");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/email-suppression.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the lib**

```typescript
// src/lib/email/suppression.ts
/**
 * Email-channel suppression. Automated senders (flow send_email nodes, later
 * campaign sends) call isEmailSuppressed before creating a message. The
 * Resend webhook feeds the list on hard bounces and spam complaints.
 */
import { prisma } from "@/lib/prisma";

export function normalizeEmail(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/<([^>]+)>/);
  return (m?.[1] ?? raw).trim().toLowerCase();
}

/**
 * Given a Resend webhook event type and its bounce payload, return the
 * suppression reason to record, or null when the event is not suppressing.
 * Soft bounces are transient (full mailbox etc) and do not suppress.
 */
export function decideSuppression(
  eventType: string,
  bounce: { type?: string } | undefined,
): "HARD_BOUNCE" | "COMPLAINT" | null {
  if (eventType === "email.complained") return "COMPLAINT";
  if (eventType === "email.bounced") {
    if (bounce?.type && bounce.type.toLowerCase() === "soft") return null;
    return "HARD_BOUNCE";
  }
  return null;
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const norm = normalizeEmail(email);
  if (!norm) return true; // nothing to send to
  const hit = await prisma.emailSuppression.findUnique({ where: { email: norm } });
  return Boolean(hit);
}

export async function addEmailSuppression(
  email: string,
  reason: "HARD_BOUNCE" | "COMPLAINT" | "UNSUBSCRIBE" | "MANUAL",
  source?: string,
): Promise<void> {
  const norm = normalizeEmail(email);
  if (!norm || !norm.includes("@")) return;
  await prisma.emailSuppression.upsert({
    where: { email: norm },
    update: { reason, source: source ?? null },
    create: { email: norm, reason, source: source ?? null },
  });
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/email-suppression.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Wire the Resend webhook**

Read `src/app/api/emails/webhook/resend/route.ts` fully. It receives Resend events (types like `email.delivered`, `email.bounced`, `email.complained`) and updates EmailMessage statuses. Where the bounce and complaint events are handled (or after the status mapping), add suppression recording. The event payload carries the recipient in `data.to` (array or string) and bounce details in `data.bounce`. Add:

```typescript
import { addEmailSuppression, decideSuppression } from "@/lib/email/suppression";
```

and inside the handler after the event type + data are parsed:

```typescript
  const suppressReason = decideSuppression(eventType, data?.bounce as { type?: string } | undefined);
  if (suppressReason) {
    const toValues: string[] = Array.isArray(data?.to) ? (data.to as string[]) : data?.to ? [String(data.to)] : [];
    for (const addr of toValues) {
      await addEmailSuppression(addr, suppressReason, "resend-webhook").catch(() => undefined);
    }
  }
```

Adapt the variable names (`eventType`, `data`) to what the file actually uses. Do not change any existing status-mapping behavior.

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "suppression|webhook/resend" || echo CLEAN` then `npx vitest run` (all green).

```bash
git add src/lib/email/suppression.ts tests/email-suppression.test.ts src/app/api/emails/webhook/resend/route.ts
git commit -m "Email suppression list fed by Resend bounces and complaints"
```

---

### Task 3: Re-entry policy enforcement (TDD)

**Files:**
- Create: `src/lib/flow/reentry.ts`
- Modify: `src/lib/flow/executor.ts` (evaluateAndStartFlows)
- Test: `tests/flow-reentry.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/flow-reentry.test.ts
import { describe, it, expect } from "vitest";
import { shouldReenter } from "@/lib/flow/reentry";

const now = new Date("2026-08-15T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 864e5);

describe("shouldReenter", () => {
  it("ALWAYS always re-enters", () => {
    expect(shouldReenter("ALWAYS", 30, daysAgo(1), now)).toBe(true);
    expect(shouldReenter("ALWAYS", 30, null, now)).toBe(true);
  });
  it("ONCE only enters when there is no prior run", () => {
    expect(shouldReenter("ONCE", 30, null, now)).toBe(true);
    expect(shouldReenter("ONCE", 30, daysAgo(365), now)).toBe(false);
  });
  it("COOLDOWN enters when the last run is older than the cooldown", () => {
    expect(shouldReenter("COOLDOWN", 30, null, now)).toBe(true);
    expect(shouldReenter("COOLDOWN", 30, daysAgo(31), now)).toBe(true);
    expect(shouldReenter("COOLDOWN", 30, daysAgo(29), now)).toBe(false);
  });
  it("unknown policy behaves like ALWAYS", () => {
    expect(shouldReenter("???", 30, daysAgo(1), now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/flow-reentry.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```typescript
// src/lib/flow/reentry.ts
/**
 * Flow re-entry safety. Decides whether a record may start a new run of a
 * flow given the flow's policy and the record's most recent prior run.
 */
export function shouldReenter(
  policy: string,
  cooldownDays: number,
  lastRunStartedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (policy === "ONCE") return lastRunStartedAt === null;
  if (policy === "COOLDOWN") {
    if (lastRunStartedAt === null) return true;
    const cutoff = new Date(now.getTime() - cooldownDays * 864e5);
    return lastRunStartedAt < cutoff;
  }
  return true; // ALWAYS and anything unrecognized
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/flow-reentry.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Enforce in evaluateAndStartFlows**

In `src/lib/flow/executor.ts`, add import:

```typescript
import { shouldReenter } from "./reentry";
```

Inside `evaluateAndStartFlows`, in the `for (const flow of flows)` loop, after the entryCriteria check passes and before `startFlow`, add:

```typescript
      if (flow.reentryPolicy !== "ALWAYS") {
        const lastRun = await prisma.flowRun.findFirst({
          where: { flowId: flow.id, entityId },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true },
        });
        if (!shouldReenter(flow.reentryPolicy, flow.reentryCooldownDays, lastRun?.startedAt ?? null)) {
          continue;
        }
      }
```

- [ ] **Step 6: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "flow/reentry|flow/executor" || echo CLEAN` then `npx vitest run`.

```bash
git add src/lib/flow/reentry.ts tests/flow-reentry.test.ts src/lib/flow/executor.ts
git commit -m "Flows: re-entry policy (ALWAYS / ONCE / COOLDOWN) enforced on trigger"
```

---

### Task 4: send_email node upgrade (owner mailbox, threading, attribution, suppression, Contact)

**Files:**
- Modify: `src/lib/flow/nodes.ts`
- Modify: `src/lib/flow/executor.ts` (send_email case only)
- Test: `tests/flow-email-node.test.ts`

- [ ] **Step 1: Write the failing tests for the pure helpers**

```typescript
// tests/flow-email-node.test.ts
import { describe, it, expect } from "vitest";
import { ownerFieldFor, buildFromAddress } from "@/lib/flow/email-node";

describe("ownerFieldFor", () => {
  it("maps each entity to its owner column", () => {
    expect(ownerFieldFor("Lead")).toBe("assignedToId");
    expect(ownerFieldFor("Opportunity")).toBe("assignedToId");
    expect(ownerFieldFor("Contact")).toBe("ownerId");
    expect(ownerFieldFor("Account")).toBe("ownerId");
    expect(ownerFieldFor("Case")).toBe("ownerId");
    expect(ownerFieldFor("Task")).toBeNull();
  });
});

describe("buildFromAddress", () => {
  it("formats a quoted display name with the mailbox", () => {
    expect(buildFromAddress({ name: 'Bar "The Man" Elezra', mailboxAddress: "bar@x.com", email: "b@y.com" }))
      .toBe('"Bar \\"The Man\\" Elezra" <bar@x.com>');
  });
  it("falls back to login email when no mailbox is set", () => {
    expect(buildFromAddress({ name: "Ann", mailboxAddress: null, email: "ann@y.com" }))
      .toBe('"Ann" <ann@y.com>');
  });
  it("returns null when the user has no usable address", () => {
    expect(buildFromAddress(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/flow-email-node.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Create the helper module**

```typescript
// src/lib/flow/email-node.ts
/** Pure helpers for the send_email flow node. */

export function ownerFieldFor(entityType: string): string | null {
  switch (entityType) {
    case "Lead":
    case "Opportunity":
      return "assignedToId";
    case "Contact":
    case "Account":
    case "Case":
      return "ownerId";
    default:
      return null;
  }
}

export function buildFromAddress(
  user: { name: string | null; mailboxAddress: string | null; email: string | null } | null,
): string | null {
  if (!user) return null;
  const addr = user.mailboxAddress ?? user.email;
  if (!addr) return null;
  const safeName = (user.name ?? addr).replace(/"/g, '\\"');
  return `"${safeName}" <${addr}>`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/flow-email-node.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Extend node config + entities in nodes.ts**

In `src/lib/flow/nodes.ts`:

a) `DEFAULT_NODE_CONFIG.send_email` becomes:

```typescript
  send_email: {
    templateId: "",
    subject: "",
    body: "",
    toFieldPath: "email",
    fromMode: "owner", // "owner" = record owner's mailbox; "company" = EMAIL_FROM default
  },
```

b) Add Contact to entities:

```typescript
export const SUPPORTED_ENTITIES = [
  "Lead",
  "Contact",
  "Opportunity",
  "Account",
  "Case",
  "Task",
  "Event",
] as const;
```

c) Add the INACTIVITY trigger event (used in Task 5, added here so nodes.ts is touched once):

```typescript
export const TRIGGER_EVENTS = ["INSERT", "UPDATE", "INSERT_OR_UPDATE", "INACTIVITY"] as const;
```

- [ ] **Step 6: Rewrite the send_email case in executor.ts**

Add imports at the top of `src/lib/flow/executor.ts`:

```typescript
import { normalizeSubject } from "@/lib/email/threading";
import { isEmailSuppressed } from "@/lib/email/suppression";
import { buildFromAddress, ownerFieldFor } from "./email-node";
```

Replace the entire `case "send_email": { ... }` block with:

```typescript
    case "send_email": {
      const templateId = (node.config?.templateId as string | undefined) || null;
      const subjectTpl = String(node.config?.subject ?? "");
      const bodyTpl = String(node.config?.body ?? "");
      const toFieldPath = String(node.config?.toFieldPath ?? "email");
      const fromMode = String(node.config?.fromMode ?? "owner");
      const toRaw = getPath(record, toFieldPath);
      const to = toRaw == null ? "" : String(toRaw);
      if (!to) return { ok: false, error: `No recipient at path "${toFieldPath}"` };

      // Suppressed recipients skip the send but the flow continues.
      if (!ctx.dryRun && (await isEmailSuppressed(to))) {
        return { ok: true, output: { skipped: "suppressed", to } };
      }

      // Resolve the sending identity: record owner's mailbox, else company default.
      const ownerField = ownerFieldFor(ctx.entityType);
      const ownerId = ownerField ? ((record[ownerField] as string | null | undefined) ?? null) : null;
      let fromAddress: string | null = null;
      if (fromMode === "owner" && ownerId) {
        const owner = await prisma.user.findUnique({
          where: { id: ownerId },
          select: { name: true, mailboxAddress: true, email: true },
        });
        fromAddress = buildFromAddress(owner);
      }
      if (!fromAddress) {
        fromAddress = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
      }

      const subject = mergeFlowTemplate(subjectTpl, record);
      const body = mergeFlowTemplate(bodyTpl, record);
      if (ctx.dryRun) {
        return { ok: true, output: { dryRun: true, to, from: fromAddress, subject, templateId } };
      }
      try {
        const msgData: AnyRecord = {
          direction: "OUTBOUND",
          status: "QUEUED",
          fromAddress,
          toAddresses: to,
          subject: subject || "(no subject)",
          subjectNorm: normalizeSubject(subject || "(no subject)"),
          bodyHtml: body || null,
          bodyText: body || null,
          provider: "RESEND",
          templateId: templateId || null,
          ownerId,
          flowId: ctx.flowId,
          flowRunId: ctx.runId,
        };
        if (ctx.entityType === "Lead") msgData.leadId = ctx.entityId;
        else if (ctx.entityType === "Contact") msgData.contactId = ctx.entityId;
        else if (ctx.entityType === "Opportunity") msgData.opportunityId = ctx.entityId;
        else if (ctx.entityType === "Account") msgData.accountId = ctx.entityId;
        else if (ctx.entityType === "Case") msgData.caseId = ctx.entityId;
        const msg = await prisma.emailMessage.create({ data: msgData as never, select: { id: true } });
        // New sends anchor their own conversation thread.
        await prisma.emailMessage.update({ where: { id: msg.id }, data: { threadId: msg.id } });
        // Best-effort immediate send; queue drainer will retry on failure.
        void sendQueuedEmail(msg.id).catch(() => undefined);
        return { ok: true, output: { emailMessageId: msg.id, to, from: fromAddress } };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "email create failed" };
      }
    }
```

Notes: `flowId: "dry-run"` never reaches the DB because dryRun returns earlier. `ownerId` may be null (company sends with no owner); that is fine, the message just does not appear in a personal Sent folder.

- [ ] **Step 7: Wire contact creation to flow triggers**

Contact-created flows only fire if the contact create path runs `evaluateAndStartFlows`. Check `src/app/api/contacts/route.ts` POST: if it uses `triggerCreate("contact", ...)` from `@/lib/triggers/runner`, nothing to do. If it calls `prisma.contact.create` directly, add after the successful create (fire-and-forget, matching the executor's contract):

```typescript
import { evaluateAndStartFlows } from "@/lib/flow/executor";
// after the create:
void evaluateAndStartFlows("Contact", "INSERT", created as unknown as Record<string, unknown>).catch(() => undefined);
```

where `created` is the full created contact row. Do not restructure the route.

- [ ] **Step 8: Add the fromMode control to the editor**

Read `src/components/flow/flow-editor.tsx` and find the config panel for `send_email` nodes (where templateId/subject/body/toFieldPath inputs are rendered). Add a select following the file's exact input conventions:

```tsx
<select
  value={String(node.config.fromMode ?? "owner")}
  onChange={/* same config-update handler the sibling inputs use, key "fromMode" */}
>
  <option value="owner">From record owner&apos;s mailbox</option>
  <option value="company">From company default address</option>
</select>
```

Label it "Send from". Mirror whatever label/wrapper markup the sibling fields use.

- [ ] **Step 9: Verify + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "flow/|flow-editor" || echo CLEAN` then `npx vitest run` (all green).

```bash
git add src/lib/flow/nodes.ts src/lib/flow/executor.ts src/lib/flow/email-node.ts tests/flow-email-node.test.ts src/components/flow/flow-editor.tsx
git commit -m "Flow send_email: owner mailbox sender, threading, attribution, suppression, Contact entity"
```

---

### Task 5: Inactivity trigger + sweep endpoint

**Files:**
- Create: `src/app/api/flow/sweep/route.ts`
- Modify: `src/app/api/flows/route.ts` and `src/app/api/flows/[id]/route.ts` (accept new Flow fields)
- Modify: flow editor trigger UI (`src/components/flow/flow-editor.tsx` and/or `src/app/(dashboard)/automation/flows/new/page.tsx`, wherever triggerEvent is picked)

- [ ] **Step 1: The sweep route**

```typescript
// src/app/api/flow/sweep/route.ts
/**
 * Inactivity sweep. For every active Flow with triggerEvent=INACTIVITY, finds
 * records of the flow's entityType with no email/call/task activity in the
 * last `inactivityDays` days and starts runs (respecting entry criteria and
 * the flow's re-entry policy; ALWAYS is treated as COOLDOWN over the
 * inactivity window so a record cannot re-enter on every sweep).
 *
 *   POST /api/flow/sweep
 *   Headers: Authorization: Bearer ${FLOW_POLL_SECRET}
 *     (falls back to PROCESSOR_SYNC_SECRET, same contract as /api/flow/poll)
 *
 * Call daily (or hourly) from the same external cron that hits /api/flow/poll.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startFlow } from "@/lib/flow/executor";
import { evaluateCondition } from "@/lib/flow/condition";
import { shouldReenter } from "@/lib/flow/reentry";
import type { ConditionGroup } from "@/lib/flow/nodes";

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

const BATCH_PER_FLOW = 200;

/** Inactivity where-clause per entity: nothing on the activity relations since the cutoff. */
function inactivityWhere(entityType: string, cutoff: Date): Record<string, unknown> | null {
  const noneSince = { none: { createdAt: { gte: cutoff } } };
  switch (entityType) {
    case "Lead":
      return { createdAt: { lt: cutoff }, emails: noneSince, calls: noneSince, tasks: noneSince };
    case "Contact":
      return { createdAt: { lt: cutoff }, emails: noneSince, tasks: noneSince };
    case "Account":
      return { createdAt: { lt: cutoff }, emails: noneSince, tasks: noneSince };
    default:
      return null; // other entities not supported for inactivity
  }
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const flows = await prisma.flow.findMany({
    where: { isActive: true, triggerEvent: "INACTIVITY" },
  });
  const results: Array<{ flowId: string; started: number; scanned: number; skipped?: string }> = [];
  for (const flow of flows) {
    const days = flow.inactivityDays ?? 0;
    if (days <= 0) {
      results.push({ flowId: flow.id, started: 0, scanned: 0, skipped: "no inactivityDays" });
      continue;
    }
    const cutoff = new Date(Date.now() - days * 864e5);
    const where = inactivityWhere(flow.entityType, cutoff);
    if (!where) {
      results.push({ flowId: flow.id, started: 0, scanned: 0, skipped: `entity ${flow.entityType} unsupported` });
      continue;
    }
    const model = flow.entityType.toLowerCase();
    const delegate = (prisma as unknown as Record<string, { findMany: (a: object) => Promise<Array<Record<string, unknown>>> }>)[model];
    if (!delegate?.findMany) {
      results.push({ flowId: flow.id, started: 0, scanned: 0, skipped: "no delegate" });
      continue;
    }
    const candidates = await delegate.findMany({ where, take: BATCH_PER_FLOW });
    let started = 0;
    for (const record of candidates) {
      const entityId = String(record.id ?? "");
      if (!entityId) continue;
      const criteria = (flow.entryCriteria as unknown as ConditionGroup | null) ?? null;
      if (!evaluateCondition(criteria, record)) continue;
      const lastRun = await prisma.flowRun.findFirst({
        where: { flowId: flow.id, entityId },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      });
      // ALWAYS would refire on every sweep, so it is treated as a cooldown of
      // the inactivity window itself. ONCE / COOLDOWN follow the flow's policy.
      const policy = flow.reentryPolicy === "ALWAYS" ? "COOLDOWN" : flow.reentryPolicy;
      const cooldown = flow.reentryPolicy === "ALWAYS" ? days : flow.reentryCooldownDays;
      if (!shouldReenter(policy, cooldown, lastRun?.startedAt ?? null)) continue;
      try {
        await startFlow(flow.id, flow.entityType, entityId, record);
        started += 1;
      } catch {
        // Trace already records the failure; keep sweeping.
      }
    }
    results.push({ flowId: flow.id, started, scanned: candidates.length });
  }
  return NextResponse.json({ ok: true, flows: results.length, results });
}
```

- [ ] **Step 2: Accept the new Flow fields in the flows APIs**

Read `src/app/api/flows/route.ts` (POST create) and `src/app/api/flows/[id]/route.ts` (PATCH update). Wherever they validate/whitelist Flow fields (zod schema or manual pick), add:

```typescript
  reentryPolicy: z.enum(["ALWAYS", "ONCE", "COOLDOWN"]).optional(),
  reentryCooldownDays: z.number().int().min(1).max(3650).optional(),
  inactivityDays: z.number().int().min(1).max(3650).optional().nullable(),
```

(adapt to the file's actual validation style; if it whitelists keys manually, add the three keys to the pick list and pass through to prisma). If triggerEvent is validated against a fixed list, ensure "INACTIVITY" is allowed (TRIGGER_EVENTS from nodes.ts already includes it after Task 4).

- [ ] **Step 3: Editor UI for the trigger + safety fields**

Read the flow editor/new-flow UI to find where triggerEvent is selected (likely a select over TRIGGER_EVENTS). Following the file's conventions:

1. Ensure the select shows the new option, labeled "Inactivity (no touch in N days)". If it maps TRIGGER_EVENTS automatically it appears on its own; give it a friendly label if there is a label map.
2. When triggerEvent is INACTIVITY, show a number input bound to `inactivityDays` (label "Days without activity", min 1, e.g. default 14). Hide `triggerOnFieldChanges` for INACTIVITY if that control is conditional.
3. Add a "Re-entry" select bound to `reentryPolicy` with options: "Every trigger (ALWAYS)", "Once per record (ONCE)", "Cooldown (COOLDOWN)"; when COOLDOWN, show a number input for `reentryCooldownDays`.
4. Make sure save handlers include the three new fields in the payload.

- [ ] **Step 4: Functional verification of the sweep**

With `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm_local`:
1. Seed via throwaway tsx script (delete after): one Flow { entityType "Lead", triggerEvent "INACTIVITY", inactivityDays 7, reentryPolicy "ALWAYS", isActive true, graph: start -> send_email(toFieldPath "email", subject "We miss you {{contactName}}", fromMode "company") -> end } and one Lead older than 7 days (createdAt 10 days ago, email "sweep-test@example.com") with no recent emails/calls/tasks.
2. Start dev server (PORT=3009, DATABASE_URL override). POST /api/flow/sweep with `Authorization: Bearer $FLOW_POLL_SECRET` (set FLOW_POLL_SECRET=sweeptest in the dev server env and use it).
3. Expect `{ ok: true, results: [{ started: 1, ... }] }`. Verify: FlowRun created (COMPLETED or FAILED only at the actual Resend send, which is fine locally without RESEND_API_KEY: the message row must exist with status QUEUED or FAILED); EmailMessage has flowId, flowRunId, threadId = own id, subjectNorm set, toAddresses sweep-test@example.com.
4. POST the sweep again: expect `started: 0` (ALWAYS treated as inactivity-window cooldown).
5. Add EmailSuppression row for sweep-test@example.com, reset (delete run + message + suppression gate check): create a second lead, run sweep, verify the run trace shows `skipped: "suppressed"` and no message row.
6. Clean up all seeded rows and scripts, kill the server.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/flow/sweep/route.ts src/app/api/flows "src/app/(dashboard)/automation/flows" src/components/flow
git commit -m "Flows: INACTIVITY trigger with authorized sweep endpoint and editor controls"
```

---

### Task 6: Email Center Flows tab (Klaviyo-style list)

**Files:**
- Replace: `src/app/(dashboard)/email-center/flows/page.tsx`
- Create: `src/app/(dashboard)/email-center/flows/flows-client.tsx`
- Modify: `src/app/(dashboard)/email-center/email-center.css` (append list styles)

- [ ] **Step 1: Server page**

```tsx
// src/app/(dashboard)/email-center/flows/page.tsx
import { prisma } from "@/lib/prisma";
import { FlowsClient } from "./flows-client";

export const dynamic = "force-dynamic";

export default async function EmailCenterFlowsPage() {
  const flows = await prisma.flow.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      entityType: true,
      triggerEvent: true,
      inactivityDays: true,
      reentryPolicy: true,
      isActive: true,
      updatedAt: true,
      _count: { select: { runs: true } },
    },
  });
  const lastRuns = await prisma.flowRun.groupBy({
    by: ["flowId"],
    _max: { startedAt: true },
  });
  const lastByFlow = new Map(lastRuns.map((r) => [r.flowId, r._max.startedAt]));
  return (
    <FlowsClient
      flows={flows.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        entityType: f.entityType,
        triggerEvent: f.triggerEvent,
        inactivityDays: f.inactivityDays,
        reentryPolicy: f.reentryPolicy,
        isActive: f.isActive,
        runCount: f._count.runs,
        lastRunAt: lastByFlow.get(f.id)?.toISOString() ?? null,
      }))}
    />
  );
}
```

- [ ] **Step 2: Client list with active toggle**

```tsx
// src/app/(dashboard)/email-center/flows/flows-client.tsx
"use client";

/**
 * Email Center Flows tab: Klaviyo-style list over the existing Flow builder.
 * Rows link into the full canvas editor at /automation/flows/[id]; the toggle
 * PATCHes isActive through the existing /api/flows/[id] route.
 */
import { useState } from "react";
import Link from "next/link";

interface FlowRow {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  triggerEvent: string;
  inactivityDays: number | null;
  reentryPolicy: string;
  isActive: boolean;
  runCount: number;
  lastRunAt: string | null;
}

function triggerLabel(f: FlowRow): string {
  switch (f.triggerEvent) {
    case "INSERT": return `${f.entityType} created`;
    case "UPDATE": return `${f.entityType} updated`;
    case "INSERT_OR_UPDATE": return `${f.entityType} created or updated`;
    case "INACTIVITY": return `${f.entityType} inactive ${f.inactivityDays ?? "?"}d`;
    default: return f.triggerEvent;
  }
}

export function FlowsClient({ flows: initial }: { flows: FlowRow[] }) {
  const [flows, setFlows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(f: FlowRow) {
    setBusy(f.id);
    const res = await fetch(`/api/flows/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !f.isActive }),
    });
    if (res.ok) {
      setFlows((prev) => prev.map((x) => (x.id === f.id ? { ...x, isActive: !f.isActive } : x)));
    }
    setBusy(null);
  }

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Flows</h1>
          <p className="ec-flows-sub">
            Automations that send email, create tasks, and update records. Built in the flow canvas.
          </p>
        </div>
        <Link className="ec-btn ec-btn-primary" href="/automation/flows/new">
          New Flow
        </Link>
      </div>
      {flows.length === 0 ? (
        <div className="ec-empty" style={{ paddingTop: 60 }}>
          <div className="ec-empty-title">No flows yet</div>
          <div className="ec-empty-sub">Create your first automation in the flow canvas.</div>
        </div>
      ) : (
        <div className="ec-flows-list">
          {flows.map((f) => (
            <div key={f.id} className="ec-flow-row">
              <button
                className={`ec-switch${f.isActive ? " ec-switch-on" : ""}`}
                title={f.isActive ? "Deactivate" : "Activate"}
                disabled={busy === f.id}
                onClick={() => void toggle(f)}
              >
                <span className="ec-switch-knob" />
              </button>
              <Link href={`/automation/flows/${f.id}`} className="ec-flow-main">
                <span className="ec-flow-name">{f.name}</span>
                {f.description ? <span className="ec-flow-desc">{f.description}</span> : null}
              </Link>
              <span className="ec-pill ec-pill-neutral">{triggerLabel(f)}</span>
              {f.reentryPolicy !== "ALWAYS" ? (
                <span className="ec-pill ec-pill-neutral">{f.reentryPolicy.toLowerCase()}</span>
              ) : null}
              <span className="ec-flow-stat">
                {f.runCount} run{f.runCount === 1 ? "" : "s"}
                {f.lastRunAt
                  ? ` · last ${new Date(f.lastRunAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                  : ""}
              </span>
              <span className={`ec-pill ${f.isActive ? "ec-pill-live" : "ec-pill-neutral"}`}>
                {f.isActive ? "Live" : "Draft"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Append list styles to email-center.css**

```css
/* ---------- Flows tab ---------- */

.ec-flows-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px;
}

.ec-flows-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  max-width: 920px;
  margin-bottom: 18px;
}

.ec-flows-title {
  font-size: 22px;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.ec-flows-sub {
  font-size: 13px;
  color: var(--ec-muted);
  margin-top: 3px;
}

.ec-flows-list {
  max-width: 920px;
  background: #ffffff;
  border: 1px solid var(--ec-border);
  border-radius: 14px;
  box-shadow: var(--ec-shadow);
  overflow: hidden;
}

.ec-flow-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--ec-border-soft);
  animation: ec-fade-up 0.25s ease both;
}

.ec-flow-row:last-child {
  border-bottom: 0;
}

.ec-flow-main {
  flex: 1;
  min-width: 0;
  text-decoration: none;
  color: var(--ec-ink);
}

.ec-flow-name {
  display: block;
  font-size: 14px;
  font-weight: 650;
}

.ec-flow-main:hover .ec-flow-name {
  text-decoration: underline;
}

.ec-flow-desc {
  display: block;
  font-size: 12.5px;
  color: var(--ec-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ec-flow-stat {
  font-size: 12px;
  color: var(--ec-muted);
  flex-shrink: 0;
}

.ec-pill-live {
  background: var(--ec-lime);
  color: #131313;
}

.ec-switch {
  width: 34px;
  height: 20px;
  border-radius: 999px;
  border: 0;
  background: var(--ec-border);
  position: relative;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;
}

.ec-switch-on {
  background: #131313;
}

.ec-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  transition: transform 0.15s ease;
}

.ec-switch-on .ec-switch-knob {
  transform: translateX(14px);
}

.ec-switch:disabled {
  opacity: 0.5;
}
```

- [ ] **Step 4: Remove the "1c" soon-pill for Flows in the rail**

In `src/app/(dashboard)/email-center/tab-rail.tsx`, delete `soon: "1c"` from the Flows tab entry (it is live now).

- [ ] **Step 5: Verify + commit**

`npx tsc --noEmit 2>&1 | grep -iE "email-center/flows" || echo CLEAN`, then dev-server render check happens in Task 7.

```bash
git add "src/app/(dashboard)/email-center" 
git commit -m "Email Center Flows tab: Klaviyo-style list with live toggles"
```

---

### Task 7: Full verification pass

- [ ] **Step 1: Suite + build + lint**

Run: `npx vitest run` (expect 170+ green incl the new suppression/reentry/email-node tests), `npm run build` (success), `npx eslint "src/app/(dashboard)/email-center" src/lib/flow src/lib/email 2>&1 | tail -3` (no errors in touched files).

- [ ] **Step 2: E2E in the browser**

Seed (throwaway script, local DB): an admin user with a mailbox (reuse the Task 1a pattern: role SUPER_ADMIN + System_Administrator profile, bcrypt password), one Lead owned by them with an email address, and one Flow { entityType "Lead", triggerEvent "INSERT", send_email node with fromMode "owner" }. Then:
1. Dev server (PORT=3009). Log in via Playwright.
2. /email-center/flows: list renders with the seeded flow, toggle flips Live/Draft and persists on reload, "New Flow" links to the canvas.
3. Trigger a run: simplest is a direct tsx script calling `evaluateAndStartFlows("Lead", "INSERT", leadRecord)` from src/lib/flow/executor, since not all API create paths use trigger wrappers. Verify FlowRun exists and EmailMessage has: fromAddress = the owner's quoted mailbox, ownerId = owner, flowId/flowRunId set, threadId = own id, subjectNorm set.
4. /email-center (inbox) as that user: the flow send appears in their Sent folder.
5. Screenshot the flows tab.
6. Clean everything up (runs, message, flow, lead, user, scripts), kill the server.

- [ ] **Step 3: Commit anything outstanding; do NOT push**

Deploy only when Bar says so. Note for the deploy checklist: the external cron that hits `/api/flow/poll` should also POST `/api/flow/sweep` daily; sweep does nothing until an INACTIVITY flow exists.
