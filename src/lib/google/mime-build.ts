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
