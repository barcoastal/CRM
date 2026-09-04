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
  if (html) return stripHtmlToText(html);
  if (p.body?.data) return decodeBase64Url(p.body.data);
  return "";
}

/**
 * Turn HTML into a readable plaintext snippet. Removes <style>/<script>/<head>
 * blocks and comments FIRST so their contents (CSS rules, conditional-comment
 * markup) don't leak into the text, then strips remaining tags. Without this,
 * marketing emails dump their entire stylesheet as "body text".
 */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Walk a Gmail payload tree and return the decoded text/html part, or "". */
export function extractHtmlBody(payload: unknown): string {
  type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
  const p = payload as Part | undefined;
  if (!p) return "";
  const walk = (part: Part): string | null => {
    if (part.mimeType === "text/html" && part.body?.data) return decodeBase64Url(part.body.data);
    for (const child of part.parts ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  return walk(p) ?? "";
}
