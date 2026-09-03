# Email Center Gmail Send (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let reps send, reply, reply-all, and forward 1:1 email through their own real Gmail from the Email Center, with file attachments.

**Architecture:** A pure RFC-2822 MIME builder produces a raw message; a write-capable Gmail client (JWT on the already-authorized `https://mail.google.com/` scope) sends it as the impersonated rep; a `gmail-send` service persists the sent message as an `EmailMessage` (provider `GMAIL`, threaded, record-linked) plus `EmailAttachment` rows. New routes handle attachment upload, sending, and attachment download. Bulk campaigns/flows are untouched (still Resend).

**Tech Stack:** Next.js App Router, Prisma (Postgres), googleapis, vitest. Follows the existing `gmail-sync.ts` injected-deps pattern and the `attachments-storage.ts` `/data` volume pattern.

Spec: `docs/superpowers/specs/2026-09-03-email-center-gmail-actions-design.md`

---

## File structure

- Create `src/lib/google/mime-build.ts` — pure MIME construction.
- Create `tests/gmail-mime.test.ts` — MIME builder unit tests.
- Modify `src/lib/google/gmail-client.ts` — add `GmailWriteClient` + `makeGmailWriteClient`.
- Create `src/lib/google/gmail-send.ts` — send orchestration (mockable).
- Create `tests/gmail-send.test.ts` — send-service unit tests (mocked deps).
- Modify `prisma/schema.prisma` — `EmailAttachment` model + `EmailMessage.gmailThreadId` + relation.
- Create `src/app/api/emails/attachments/route.ts` — multipart upload.
- Create `src/app/api/emails/gmail/send/route.ts` — new/reply/reply-all/forward.
- Create `src/app/api/emails/[id]/attachments/[attId]/route.ts` — download stream.
- Modify Email Center inbox client component — compose attachments + Reply/Reply-all/Forward.

---

## Task 1: Schema — EmailAttachment + gmailThreadId

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the `gmailThreadId` field and attachments relation to `EmailMessage`**

In `model EmailMessage`, next to the existing `gmailMessageId` line, add:

```prisma
  // Gmail thread id for synced/sent Gmail rows; lets replies land in the exact
  // same Gmail conversation when we send.
  gmailThreadId   String?
```

And in the relations area of `EmailMessage` (near `events EmailEvent[] ...`), add:

```prisma
  attachments EmailAttachment[] @relation("EmailMessageAttachments")
```

- [ ] **Step 2: Add the `EmailAttachment` model**

Add at the end of the file:

```prisma
model EmailAttachment {
  id           String       @id @default(cuid())
  messageId    String
  message      EmailMessage @relation("EmailMessageAttachments", fields: [messageId], references: [id], onDelete: Cascade)
  filename     String
  contentType  String
  byteSize     Int
  // OUTBOUND: file saved on the /data volume (relative path under attachmentsDir()).
  storagePath  String?
  // INBOUND: fetched from Gmail on demand via users.messages.attachments.get.
  gmailAttachmentId String?
  createdAt    DateTime     @default(now())

  @@index([messageId])
}
```

- [ ] **Step 3: Apply the schema to the local dev DB**

Run: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm_local npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema" and the Prisma client regenerates.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (new Prisma types available).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "Gmail send: EmailAttachment model + EmailMessage.gmailThreadId"
```

---

## Task 2: Pure MIME builder

**Files:**
- Create: `src/lib/google/mime-build.ts`
- Test: `tests/gmail-mime.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/gmail-mime.test.ts
import { describe, it, expect } from "vitest";
import { buildMime } from "@/lib/google/mime-build";

function decode(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

describe("buildMime", () => {
  it("builds a simple text message with the core headers", () => {
    const raw = buildMime({
      from: "rep@coastaldebt.com",
      to: ["client@brightpath.com"],
      subject: "Hello there",
      bodyText: "Hi Client",
      messageId: "<abc@coastaldebt.com>",
    });
    const s = decode(raw);
    expect(s).toContain("From: rep@coastaldebt.com");
    expect(s).toContain("To: client@brightpath.com");
    expect(s).toContain("Subject: Hello there");
    expect(s).toContain("Message-ID: <abc@coastaldebt.com>");
    expect(s).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(s).toContain(Buffer.from("Hi Client", "utf8").toString("base64"));
  });

  it("adds reply headers and CC", () => {
    const raw = buildMime({
      from: "rep@coastaldebt.com",
      to: ["client@brightpath.com"],
      cc: ["boss@coastaldebt.com"],
      subject: "Re: Offer",
      bodyText: "See below",
      messageId: "<def@coastaldebt.com>",
      inReplyTo: "<orig@brightpath.com>",
      references: "<orig@brightpath.com>",
    });
    const s = decode(raw);
    expect(s).toContain("Cc: boss@coastaldebt.com");
    expect(s).toContain("In-Reply-To: <orig@brightpath.com>");
    expect(s).toContain("References: <orig@brightpath.com>");
  });

  it("builds multipart/mixed with an attachment", () => {
    const raw = buildMime({
      from: "rep@coastaldebt.com",
      to: ["client@brightpath.com"],
      subject: "Docs",
      bodyText: "Attached",
      messageId: "<ghi@coastaldebt.com>",
      attachments: [{ filename: "agreement.pdf", contentType: "application/pdf", content: Buffer.from("PDFDATA") }],
    });
    const s = decode(raw);
    expect(s).toContain("Content-Type: multipart/mixed; boundary=");
    expect(s).toContain('Content-Disposition: attachment; filename="agreement.pdf"');
    expect(s).toContain("Content-Type: application/pdf");
    expect(s).toContain(Buffer.from("PDFDATA").toString("base64"));
  });

  it("RFC-2047 encodes a non-ASCII subject", () => {
    const raw = buildMime({
      from: "rep@coastaldebt.com",
      to: ["client@brightpath.com"],
      subject: "Réservé café",
      bodyText: "x",
      messageId: "<jkl@coastaldebt.com>",
    });
    const s = decode(raw);
    expect(s).toContain("Subject: =?UTF-8?B?");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/gmail-mime.test.ts`
Expected: FAIL — cannot find module `@/lib/google/mime-build`.

- [ ] **Step 3: Implement the builder**

```ts
// src/lib/google/mime-build.ts
/**
 * Pure RFC-2822 / MIME builder. Produces a base64url-encoded raw message ready
 * for Gmail users.messages.send. No I/O, fully unit-testable.
 */
export interface MimeAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface BuildMimeInput {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  messageId: string; // full "<...@domain>"
  inReplyTo?: string | null; // full "<...>"
  references?: string | null;
  attachments?: MimeAttachment[];
}

const CRLF = "\r\n";

interface Entity {
  headers: string[];
  body: string;
}

/** RFC 2047 encode a header value if it contains non-ASCII. */
function encodeHeaderWord(v: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(v)) return v;
  return `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

/** Wrap base64 at 76 columns per RFC. */
function wrap76(b64: string): string {
  return (b64.match(/.{1,76}/g) ?? []).join(CRLF);
}

function renderEntity(e: Entity): string {
  return e.headers.join(CRLF) + CRLF + CRLF + e.body;
}

function textEntity(content: string, subtype: "plain" | "html"): Entity {
  return {
    headers: [`Content-Type: text/${subtype}; charset="UTF-8"`, "Content-Transfer-Encoding: base64"],
    body: wrap76(Buffer.from(content, "utf8").toString("base64")),
  };
}

function multipart(subtype: "alternative" | "mixed", boundary: string, children: Entity[]): Entity {
  const parts = children.map(renderEntity);
  const body = `--${boundary}${CRLF}` + parts.join(`${CRLF}--${boundary}${CRLF}`) + `${CRLF}--${boundary}--`;
  return { headers: [`Content-Type: multipart/${subtype}; boundary="${boundary}"`], body };
}

function attachmentEntity(a: MimeAttachment): Entity {
  const name = encodeHeaderWord(a.filename);
  return {
    headers: [
      `Content-Type: ${a.contentType}; name="${name}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${name}"`,
    ],
    body: wrap76(a.content.toString("base64")),
  };
}

export function buildMime(input: BuildMimeInput): string {
  const idCore = input.messageId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) || "b";
  const top: string[] = [];
  top.push(`From: ${input.from}`);
  top.push(`To: ${input.to.join(", ")}`);
  if (input.cc?.length) top.push(`Cc: ${input.cc.join(", ")}`);
  if (input.bcc?.length) top.push(`Bcc: ${input.bcc.join(", ")}`);
  top.push(`Subject: ${encodeHeaderWord(input.subject)}`);
  top.push(`Message-ID: ${input.messageId}`);
  if (input.inReplyTo) top.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) top.push(`References: ${input.references}`);
  top.push("MIME-Version: 1.0");

  const hasBoth = Boolean(input.bodyText && input.bodyHtml);
  let bodyEntity: Entity = hasBoth
    ? multipart("alternative", `alt_${idCore}`, [textEntity(input.bodyText!, "plain"), textEntity(input.bodyHtml!, "html")])
    : input.bodyHtml
    ? textEntity(input.bodyHtml, "html")
    : textEntity(input.bodyText ?? "", "plain");

  const attachments = input.attachments ?? [];
  if (attachments.length > 0) {
    bodyEntity = multipart("mixed", `mixed_${idCore}`, [bodyEntity, ...attachments.map(attachmentEntity)]);
  }

  const raw = [...top, ...bodyEntity.headers].join(CRLF) + CRLF + CRLF + bodyEntity.body;
  return Buffer.from(raw, "utf8").toString("base64url");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/gmail-mime.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/mime-build.ts tests/gmail-mime.test.ts
git commit -m "Gmail send: pure RFC-2822 MIME builder with attachments + reply headers"
```

---

## Task 3: Gmail write client

**Files:**
- Modify: `src/lib/google/gmail-client.ts`

- [ ] **Step 1: Add the write-client interface and factory**

Append to `src/lib/google/gmail-client.ts` (below `makeGmailClient`):

```ts
export interface GmailWriteClient {
  /** Send a base64url raw message; threadId groups it into an existing Gmail thread. */
  sendRaw(rawBase64url: string, threadId?: string | null): Promise<{ id: string; threadId: string | null }>;
  /** Add/remove Gmail label ids on a message (markRead = remove UNREAD, archive = remove INBOX). */
  modifyLabels(messageId: string, opts: { add?: string[]; remove?: string[] }): Promise<void>;
  /** Download one attachment's bytes. */
  getAttachment(messageId: string, attachmentId: string): Promise<Buffer>;
}

/** Build a read/write Gmail client (mail.google.com scope) impersonating one rep. */
export function makeGmailWriteClient(repEmail: string): GmailWriteClient {
  const jwt = new google.auth.JWT({
    email: process.env.GOOGLE_SA_CLIENT_EMAIL,
    key: (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    scopes: ["https://mail.google.com/"],
    subject: repEmail,
  });
  const gmail = google.gmail({ version: "v1", auth: jwt });

  return {
    async sendRaw(rawBase64url, threadId) {
      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: rawBase64url, threadId: threadId ?? undefined },
      });
      return { id: res.data.id ?? "", threadId: res.data.threadId ?? null };
    },
    async modifyLabels(messageId, opts) {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: { addLabelIds: opts.add, removeLabelIds: opts.remove },
      });
    },
    async getAttachment(messageId, attachmentId) {
      const res = await gmail.users.messages.attachments.get({ userId: "me", messageId, id: attachmentId });
      return Buffer.from(res.data.data ?? "", "base64url");
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Lint**

Run: `npx eslint src/lib/google/gmail-client.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/google/gmail-client.ts
git commit -m "Gmail send: write client (send/modify/getAttachment) on mail.google.com scope"
```

---

## Task 4: Send orchestration service

**Files:**
- Create: `src/lib/google/gmail-send.ts`
- Test: `tests/gmail-send.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/gmail-send.test.ts
import { describe, it, expect, vi } from "vitest";
import { sendGmail, type SendDeps, type SendInput } from "@/lib/google/gmail-send";

function baseInput(over: Partial<SendInput> = {}): SendInput {
  return {
    repEmail: "rep@coastaldebt.com",
    repUserId: "rep1",
    to: ["client@brightpath.com"],
    subject: "Hello",
    bodyText: "Hi",
    attachments: [],
    ...over,
  };
}

function makeDeps(created: Record<string, unknown>[], attachRows: Record<string, unknown>[][]): SendDeps {
  return {
    send: vi.fn(async () => ({ id: "gm123", threadId: "gt456" })),
    resolveThread: async () => null,
    generateMessageId: (domain) => `<newid@${domain}>`,
    persist: async (msg, atts) => {
      created.push(msg);
      attachRows.push(atts as Record<string, unknown>[]);
      return { id: "em1" };
    },
  };
}

describe("sendGmail", () => {
  it("sends via Gmail and persists an OUTBOUND GMAIL message with our message-id and gmail ids", async () => {
    const created: Record<string, unknown>[] = [];
    const attachRows: Record<string, unknown>[][] = [];
    const deps = makeDeps(created, attachRows);
    const res = await sendGmail(baseInput(), deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(res.gmailId).toBe("gm123");
    expect(created[0].provider).toBe("GMAIL");
    expect(created[0].direction).toBe("OUTBOUND");
    expect(created[0].status).toBe("SENT");
    expect(created[0].ownerId).toBe("rep1");
    expect(created[0].gmailMessageId).toBe("gm123");
    expect(created[0].gmailThreadId).toBe("gt456");
    expect(created[0].messageIdHeader).toBe("newid@coastaldebt.com");
    expect(created[0].toAddresses).toBe("client@brightpath.com");
  });

  it("passes the gmail thread id through on a reply and carries record links", async () => {
    const created: Record<string, unknown>[] = [];
    const attachRows: Record<string, unknown>[][] = [];
    const deps = makeDeps(created, attachRows);
    await sendGmail(
      baseInput({
        subject: "Re: Offer",
        inReplyTo: "<orig@brightpath.com>",
        references: "<orig@brightpath.com>",
        gmailThreadId: "gt456",
        record: { leadId: "lead1" },
      }),
      deps,
    );
    expect(deps.send).toHaveBeenCalledWith(expect.any(String), "gt456");
    expect(created[0].inReplyTo).toBe("orig@brightpath.com");
    expect(created[0].leadId).toBe("lead1");
  });

  it("persists attachment rows for uploaded files", async () => {
    const created: Record<string, unknown>[] = [];
    const attachRows: Record<string, unknown>[][] = [];
    const deps = makeDeps(created, attachRows);
    await sendGmail(
      baseInput({
        attachments: [{ filename: "a.pdf", contentType: "application/pdf", content: Buffer.from("X"), storagePath: "abcd-a.pdf" }],
      }),
      deps,
    );
    expect(attachRows[0]).toHaveLength(1);
    expect(attachRows[0][0]).toMatchObject({ filename: "a.pdf", contentType: "application/pdf", byteSize: 1, storagePath: "abcd-a.pdf" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/gmail-send.test.ts`
Expected: FAIL — cannot find module `@/lib/google/gmail-send`.

- [ ] **Step 3: Implement the service**

```ts
// src/lib/google/gmail-send.ts
/**
 * Orchestrates a 1:1 Gmail send: build MIME -> send as the rep -> persist an
 * EmailMessage (provider GMAIL) + attachment rows. Pure of DB/Google specifics
 * via injected SendDeps, so it is unit-testable with mocks (same pattern as
 * gmail-sync.ts).
 */
import { buildMime } from "./mime-build";
import { normalizeSubject, normalizeMessageId } from "@/lib/email/threading";

export interface SendAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  storagePath?: string | null;
}

export interface SendRecord {
  leadId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
  opportunityId?: string | null;
  caseId?: string | null;
}

export interface SendInput {
  repEmail: string;
  repUserId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string | null; // full "<...>" from the source message
  references?: string | null;
  gmailThreadId?: string | null;
  attachments: SendAttachment[];
  record?: SendRecord;
}

export interface PersistAttachment {
  filename: string;
  contentType: string;
  byteSize: number;
  storagePath: string | null;
  gmailAttachmentId: string | null;
}

export interface SendDeps {
  send(rawBase64url: string, threadId?: string | null): Promise<{ id: string; threadId: string | null }>;
  resolveThread(counterparty: string, subject: string, inReplyTo: string | null): Promise<string | null>;
  generateMessageId(domain: string): string;
  persist(msg: Record<string, unknown>, attachments: PersistAttachment[]): Promise<{ id: string }>;
}

export async function sendGmail(input: SendInput, deps: SendDeps): Promise<{ messageId: string; gmailId: string }> {
  const domain = input.repEmail.split("@")[1] || "coastaldebt.com";
  const msgHeader = deps.generateMessageId(domain); // "<...@domain>"

  const raw = buildMime({
    from: input.repEmail,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    bodyText: input.bodyText,
    bodyHtml: input.bodyHtml,
    messageId: msgHeader,
    inReplyTo: input.inReplyTo ?? null,
    references: input.references ?? null,
    attachments: input.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, content: a.content })),
  });

  const sent = await deps.send(raw, input.gmailThreadId ?? null);

  const counterparty = input.to[0] ?? "";
  const threadId = await deps.resolveThread(
    counterparty,
    input.subject,
    input.inReplyTo ? normalizeMessageId(input.inReplyTo) : null,
  );

  const persisted = await deps.persist(
    {
      direction: "OUTBOUND",
      status: "SENT",
      provider: "GMAIL",
      fromAddress: input.repEmail,
      toAddresses: input.to.join(","),
      cc: input.cc?.length ? input.cc.join(",") : null,
      bcc: input.bcc?.length ? input.bcc.join(",") : null,
      subject: input.subject,
      subjectNorm: normalizeSubject(input.subject),
      bodyText: input.bodyText || null,
      bodyHtml: input.bodyHtml || null,
      messageIdHeader: normalizeMessageId(msgHeader),
      inReplyTo: input.inReplyTo ? normalizeMessageId(input.inReplyTo) : null,
      gmailMessageId: sent.id,
      gmailThreadId: sent.threadId,
      leadId: input.record?.leadId ?? null,
      contactId: input.record?.contactId ?? null,
      accountId: input.record?.accountId ?? null,
      opportunityId: input.record?.opportunityId ?? null,
      caseId: input.record?.caseId ?? null,
      ownerId: input.repUserId,
      sentAt: new Date(),
      threadId,
    },
    input.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      byteSize: a.content.byteLength,
      storagePath: a.storagePath ?? null,
      gmailAttachmentId: null,
    })),
  );

  return { messageId: persisted.id, gmailId: sent.id };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/gmail-send.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/gmail-send.ts tests/gmail-send.test.ts
git commit -m "Gmail send: send orchestration service (build->send->persist) with tests"
```

---

## Task 5: Attachment upload + download routes

**Files:**
- Create: `src/app/api/emails/attachments/route.ts`
- Create: `src/app/api/emails/[id]/attachments/[attId]/route.ts`

- [ ] **Step 1: Implement the upload route**

```ts
// src/app/api/emails/attachments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { saveAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/email/attachments-storage";

export const dynamic = "force-dynamic";

/**
 * POST multipart/form-data with a single "file". Saves it to the /data volume
 * and returns a stash token the composer references. The stash is a small
 * cookie-free in-memory-free approach: we return storagePath + metadata and the
 * client echoes them back on send. (No DB row until the message is actually
 * sent, so orphaned uploads are just files on disk cleaned by ops if needed.)
 */
export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_ATTACHMENT_BYTES} bytes)` }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const storagePath = await saveAttachment(buf, file.name);
  return NextResponse.json({
    storagePath,
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    byteSize: buf.byteLength,
  });
}
```

- [ ] **Step 2: Implement the download route**

```ts
// src/app/api/emails/[id]/attachments/[attId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { readAttachment } from "@/lib/email/attachments-storage";
import { makeGmailWriteClient, gmailConfigured } from "@/lib/google/gmail-client";

export const dynamic = "force-dynamic";
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

/**
 * GET streams one attachment. Outgoing files come from the /data volume;
 * inbound Gmail attachments are fetched live from the owner's mailbox.
 * Access: admins, or the owner of the parent message.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; attId: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id, attId } = await ctx.params;

  const att = await prisma.emailAttachment.findUnique({
    where: { id: attId },
    include: { message: { select: { id: true, ownerId: true, gmailMessageId: true, owner: { select: { email: true } } } } },
  });
  if (!att || att.messageId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = ADMIN_ROLES.includes(r.session.role);
  if (!isAdmin && att.message.ownerId !== r.session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let bytes: Buffer;
  if (att.storagePath) {
    bytes = await readAttachment(att.storagePath);
  } else if (att.gmailAttachmentId && att.message.gmailMessageId && att.message.owner?.email) {
    if (!gmailConfigured()) return NextResponse.json({ error: "Gmail not configured" }, { status: 400 });
    const client = makeGmailWriteClient(att.message.owner.email.toLowerCase());
    bytes = await client.getAttachment(att.message.gmailMessageId, att.gmailAttachmentId);
  } else {
    return NextResponse.json({ error: "Unavailable" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": att.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${att.filename.replace(/"/g, "")}"`,
      "Content-Length": String(bytes.byteLength),
    },
  });
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "src/app/api/emails/attachments/route.ts" "src/app/api/emails/[id]/attachments/[attId]/route.ts"`
Expected: exit 0, no lint errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/emails/attachments/route.ts" "src/app/api/emails/[id]/attachments/[attId]/route.ts"
git commit -m "Gmail send: attachment upload + download (disk / on-demand Gmail) routes"
```

---

## Task 6: Send route (new / reply / reply-all / forward)

**Files:**
- Create: `src/app/api/emails/gmail/send/route.ts`

- [ ] **Step 1: Implement the route**

```ts
// src/app/api/emails/gmail/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { gmailConfigured, makeGmailWriteClient } from "@/lib/google/gmail-client";
import { sendGmail, type SendDeps, type SendAttachment } from "@/lib/google/gmail-send";
import { generateMessageId } from "@/lib/email-sender";
import { resolveThreadId, prismaThreadFinders } from "@/lib/email/threading";
import { readAttachment } from "@/lib/email/attachments-storage";

export const dynamic = "force-dynamic";

const attachmentSchema = z.object({
  storagePath: z.string(),
  filename: z.string(),
  contentType: z.string().default("application/octet-stream"),
  byteSize: z.number().int().nonnegative().optional(),
});

const bodySchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().default(""),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  attachments: z.array(attachmentSchema).default([]),
  replyToMessageId: z.string().optional(), // our EmailMessage.id
  forwardMessageId: z.string().optional(), // our EmailMessage.id
});

const withBrackets = (id: string | null | undefined) => (id ? (id.startsWith("<") ? id : `<${id}>`) : null);

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  if (!gmailConfigured()) return NextResponse.json({ error: "Gmail not configured" }, { status: 400 });

  const me = await prisma.user.findUnique({ where: { id: r.session.userId }, select: { email: true } });
  if (!me?.email) return NextResponse.json({ error: "Your user has no email" }, { status: 400 });
  const repEmail = me.email.toLowerCase();

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // Resolve reply/forward source for threading + record links + forwarded files.
  let inReplyTo: string | null = null;
  let references: string | null = null;
  let gmailThreadId: string | null = null;
  let record: Record<string, string | null> = {};
  const sourceId = d.replyToMessageId ?? d.forwardMessageId;
  let forwardedAttachments: SendAttachment[] = [];
  if (sourceId) {
    const src = await prisma.emailMessage.findUnique({
      where: { id: sourceId },
      include: { attachments: true, owner: { select: { email: true } } },
    });
    if (src) {
      record = { leadId: src.leadId, contactId: src.contactId, accountId: src.accountId, opportunityId: src.opportunityId, caseId: src.caseId };
      if (d.replyToMessageId) {
        inReplyTo = withBrackets(src.messageIdHeader);
        references = withBrackets(src.messageIdHeader);
        gmailThreadId = src.gmailThreadId;
      }
      if (d.forwardMessageId) {
        // Re-attach the original's files (Gmail-hosted fetched live; disk read from /data).
        const client = makeGmailWriteClient(repEmail);
        for (const a of src.attachments) {
          try {
            const content = a.storagePath
              ? await readAttachment(a.storagePath)
              : a.gmailAttachmentId && src.gmailMessageId
              ? await client.getAttachment(src.gmailMessageId, a.gmailAttachmentId)
              : null;
            if (content) forwardedAttachments.push({ filename: a.filename, contentType: a.contentType, content });
          } catch {
            // skip an unreadable original attachment rather than fail the forward
          }
        }
      }
    }
  }

  // Load uploaded files from disk into buffers for the MIME builder.
  const uploaded: SendAttachment[] = [];
  for (const a of d.attachments) {
    const content = await readAttachment(a.storagePath).catch(() => null);
    if (content) uploaded.push({ filename: a.filename, contentType: a.contentType, content, storagePath: a.storagePath });
  }

  const client = makeGmailWriteClient(repEmail);
  const deps: SendDeps = {
    send: (raw, threadId) => client.sendRaw(raw, threadId),
    resolveThread: (counterparty, subject, ir) => resolveThreadId({ inReplyTo: ir, subject, counterpartyEmails: [counterparty] }, prismaThreadFinders()),
    generateMessageId,
    persist: async (msg, atts) => {
      const created = await prisma.emailMessage.create({ data: msg as never, select: { id: true, threadId: true } });
      if (!created.threadId) await prisma.emailMessage.update({ where: { id: created.id }, data: { threadId: created.id } });
      if (atts.length) {
        await prisma.emailAttachment.createMany({ data: atts.map((a) => ({ ...a, messageId: created.id })) });
      }
      return { id: created.id };
    },
  };

  try {
    const result = await sendGmail(
      {
        repEmail,
        repUserId: r.session.userId,
        to: d.to,
        cc: d.cc,
        bcc: d.bcc,
        subject: d.subject,
        bodyText: d.bodyText,
        bodyHtml: d.bodyHtml,
        inReplyTo,
        references,
        gmailThreadId,
        attachments: [...uploaded, ...forwardedAttachments],
        record,
      },
      deps,
    );
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gmail send failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "src/app/api/emails/gmail/send/route.ts"`
Expected: exit 0, no lint errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/emails/gmail/send/route.ts"
git commit -m "Gmail send: POST /api/emails/gmail/send (new/reply/reply-all/forward)"
```

---

## Task 7: Compose UI — attachments + reply/reply-all/forward

**Files:**
- Modify: the Email Center inbox client component (compose + thread view). Find it first.

- [ ] **Step 1: Locate the inbox client component**

Run: `grep -rln "Compose\|Select a conversation\|My inbox" "src/app/(dashboard)/email-center"`
Expected: one client component (e.g. `src/app/(dashboard)/email-center/inbox-client.tsx`). Use whatever path it prints as `<INBOX_CLIENT>` below.

- [ ] **Step 2: Add attachment state + upload handler to the composer**

In `<INBOX_CLIENT>`, inside the compose component, add state and handlers:

```tsx
type PendingAttachment = { storagePath: string; filename: string; contentType: string; byteSize: number };

const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
const [uploading, setUploading] = useState(false);

async function onPickFiles(files: FileList | null) {
  if (!files || files.length === 0) return;
  setUploading(true);
  for (const file of Array.from(files)) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/emails/attachments", { method: "POST", body: fd });
    if (res.ok) setAttachments((prev) => [...prev, (await res.json()) as PendingAttachment]);
  }
  setUploading(false);
}

function removeAttachment(storagePath: string) {
  setAttachments((prev) => prev.filter((a) => a.storagePath !== storagePath));
}
```

- [ ] **Step 3: Render the file picker + chips in the compose form**

Add near the compose send button:

```tsx
<div className="ec-attach-row">
  <label className="ec-btn ec-btn-ghost">
    Attach files
    <input type="file" multiple hidden onChange={(e) => void onPickFiles(e.target.files)} />
  </label>
  {uploading ? <span className="ec-attach-status">Uploading...</span> : null}
  {attachments.map((a) => (
    <span key={a.storagePath} className="ec-attach-chip">
      {a.filename} ({Math.ceil(a.byteSize / 1024)} KB)
      <button type="button" aria-label="Remove" onClick={() => removeAttachment(a.storagePath)}>×</button>
    </span>
  ))}
</div>
```

- [ ] **Step 4: Route the composer send through the Gmail endpoint**

Change the compose submit handler so it POSTs to the Gmail route with attachments and any reply/forward context. Replace the existing send `fetch(...)` call in the composer with:

```tsx
const res = await fetch("/api/emails/gmail/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: to.split(",").map((s) => s.trim()).filter(Boolean),
    cc: cc ? cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    subject,
    bodyText: body,
    attachments,
    replyToMessageId: replyToMessageId ?? undefined, // set when composing a reply
    forwardMessageId: forwardMessageId ?? undefined, // set when composing a forward
  }),
});
if (res.ok) {
  setAttachments([]);
  // existing post-send behavior (close composer, refresh thread list)
}
```

- [ ] **Step 5: Add Reply / Reply-all / Forward buttons to the thread view**

In the thread/message view, add buttons that open the composer pre-filled. `latest` is the most recent message in the open thread:

```tsx
<div className="ec-thread-actions">
  <button className="ec-btn" onClick={() => openComposer({
    to: latest.direction === "INBOUND" ? [latest.fromAddress] : latest.toAddresses.split(","),
    subject: latest.subject.match(/^re:/i) ? latest.subject : `Re: ${latest.subject}`,
    replyToMessageId: latest.id,
  })}>Reply</button>
  <button className="ec-btn" onClick={() => openComposer({
    to: latest.direction === "INBOUND" ? [latest.fromAddress] : latest.toAddresses.split(","),
    cc: dedupeSelfOut([...latest.toAddresses.split(","), ...(latest.cc?.split(",") ?? [])]),
    subject: latest.subject.match(/^re:/i) ? latest.subject : `Re: ${latest.subject}`,
    replyToMessageId: latest.id,
  })}>Reply all</button>
  <button className="ec-btn" onClick={() => openComposer({
    to: [],
    subject: latest.subject.match(/^fwd:/i) ? latest.subject : `Fwd: ${latest.subject}`,
    forwardMessageId: latest.id,
  })}>Forward</button>
</div>
```

Where `openComposer(prefill)` sets the composer's `to/cc/subject/replyToMessageId/forwardMessageId` state (add `replyToMessageId` and `forwardMessageId` state to the composer if not present, default `null`), and `dedupeSelfOut(list)` lowercases, dedupes, and drops the current rep's own address.

- [ ] **Step 6: Render each message's attachments with download links**

In the message body render, add:

```tsx
{msg.attachments?.length ? (
  <div className="ec-msg-attachments">
    {msg.attachments.map((a: { id: string; filename: string; byteSize: number }) => (
      <a key={a.id} className="ec-attach-chip" href={`/api/emails/${msg.id}/attachments/${a.id}`}>
        {a.filename} ({Math.ceil(a.byteSize / 1024)} KB)
      </a>
    ))}
  </div>
) : null}
```

Ensure the inbox GET that loads a thread includes `attachments: { select: { id: true, filename: true, byteSize: true } }` on each message (modify the thread/message query in the inbox API to include it).

- [ ] **Step 7: Add minimal styles**

In `src/app/(dashboard)/email-center/email-center.css` add:

```css
.ec-attach-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
.ec-attach-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border: 1px solid var(--ec-border, #e5e5e5); border-radius: 999px; font-size: 12px; text-decoration: none; color: inherit; }
.ec-attach-chip button { border: none; background: none; cursor: pointer; font-size: 14px; line-height: 1; }
.ec-attach-status { font-size: 12px; opacity: 0.7; }
.ec-thread-actions { display: flex; gap: 8px; margin-bottom: 10px; }
.ec-msg-attachments { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
```

- [ ] **Step 8: Typecheck + lint + build**

Run: `npx tsc --noEmit && npx eslint "src/app/(dashboard)/email-center" && npx next build`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(dashboard)/email-center"
git commit -m "Gmail send UI: compose attachments + reply/reply-all/forward + attachment download"
```

---

## Task 8: Full verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all green (new gmail-mime + gmail-send tests pass; existing suite unaffected). Note: there is one known pre-existing unrelated lead-conversion em-dash test failure — everything else must pass.

- [ ] **Step 2: Manual E2E (local, with GOOGLE_SA_* set on a test mailbox)**

- Enable your own mailbox in Mailbox Sync.
- Compose to a known lead address, attach a small PDF, send. Confirm: it lands in your real Gmail Sent, appears in the CRM thread as OUTBOUND with the attachment chip, and downloads correctly.
- Reply within the thread; confirm it chains in Gmail (same conversation) and in the CRM thread.
- Forward a received message that has an attachment; confirm the original file rides along.

- [ ] **Step 3: Final commit if any fixups**

```bash
git add -A
git commit -m "Gmail send phase 1: verification fixups"
```

---

## Self-review notes (addressed)

- **Spec coverage:** send/reply/reply-all/forward (Tasks 6-7), attachments send+store+download (Tasks 5-7), `EmailAttachment` + `gmailThreadId` (Task 1), MIME builder (Task 2), write client on `mail.google.com` (Task 3), persistence w/ record links + threading + our Message-ID collapse (Task 4). Mark-read/archive/label + incoming attachment metadata capture are Phase 2 (separate plan), per spec.
- **Message-ID collapse:** `generateMessageId` stamps our own id which sync dedups against, so the synced copy of a Gmail-sent message collapses (existing `messageIdHeader` dedup path).
- **Type consistency:** `SendInput`/`SendDeps`/`PersistAttachment` names used identically in Task 4 and Task 6. `storagePath` is the relative-path string from `saveAttachment` everywhere.
- **Bulk untouched:** no change to `mass-sender.ts` / Resend paths.
