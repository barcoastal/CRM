/**
 * RAM (Reliant Account Management) provider.
 *
 * Port of SF RAMApi.cls — SOAP/XML with session-based auth at
 * http://www.ramservicing.com/. Session is obtained once and cached.
 *
 * Env:
 *   RAM_API_ENDPOINT=https://app.ramservicing.com/api/services/Service.svc
 *   RAM_API_KEY=<api key from RAM portal>
 *   RAM_AFFILIATE_ID=<affiliate id>
 *   RAM_FEE_SPLIT_GROUP_ID=<fee split group id>
 *
 * Operations used:
 *   GetUpdatedSavingDetails(fromDate)  → list of { externalId, balance }
 *   GetClientDrafts(fromDate)          → list of draft status changes
 */

import type { BalanceUpdate, DraftUpdate, PaymentProcessor } from "./types";

const RAM_NS = "http://www.ramservicing.com/";
const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";

let cachedSession: { sessionId: string; expiresAt: number } | null = null;

function getEnv(): { endpoint: string; apiKey: string; affiliateId: string } {
  const endpoint = process.env.RAM_API_ENDPOINT;
  const apiKey = process.env.RAM_API_KEY;
  const affiliateId = process.env.RAM_AFFILIATE_ID;
  if (!endpoint) throw new Error("RAM_API_ENDPOINT not set");
  if (!apiKey) throw new Error("RAM_API_KEY not set");
  if (!affiliateId) throw new Error("RAM_AFFILIATE_ID not set");
  return { endpoint, apiKey, affiliateId };
}

/** Strip namespace prefix from a tag name for lookup. */
function localName(tag: string): string {
  const idx = tag.indexOf(":");
  return idx === -1 ? tag : tag.slice(idx + 1);
}

/** Naive SOAP body extractor: returns text of every leaf element matching `name`. */
function extractAll(xml: string, name: string): string[] {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}\\b[^>]*>([^<]*)</(?:[a-zA-Z0-9]+:)?${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function escapeXml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Find all occurrences of <Element>...</Element> capturing inner XML. */
function extractElements(xml: string, name: string): string[] {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

async function callSoap(method: string, innerXml: string, includeSession = true): Promise<string> {
  const { endpoint, apiKey } = getEnv();
  const sess = includeSession ? `<sessid>${escapeXml(await getSessionId())}</sessid>` : "";
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <${method} xmlns="${RAM_NS}">
      ${sess}
      ${innerXml}
    </${method}>
  </soap:Body>
</soap:Envelope>`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `${RAM_NS}${method}`,
      ApiKey: apiKey,
    },
    body,
  });
  const xml = await res.text();
  if (!res.ok) throw new Error(`RAM ${method} ${res.status}: ${xml.slice(0, 200)}`);
  return xml;
}

async function getSessionId(): Promise<string> {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession.sessionId;
  }
  const { apiKey, affiliateId } = getEnv();
  // RAM session login op
  const xml = await callSoap(
    "Login",
    `<apiKey>${escapeXml(apiKey)}</apiKey><affiliateId>${escapeXml(affiliateId)}</affiliateId>`,
    false
  );
  const ids = extractAll(xml, "sessionId");
  const sessionId = ids[0] ?? extractAll(xml, "sessid")[0];
  if (!sessionId) throw new Error("RAM Login returned no sessionId");
  // Sessions are short-lived; cache for 50 minutes
  cachedSession = { sessionId, expiresAt: Date.now() + 50 * 60 * 1000 };
  return sessionId;
}

function normalizeDraftStatus(s: string): string {
  const lower = s.toLowerCase();
  if (lower.includes("schedul")) return "SCHEDULED";
  if (lower.includes("process")) return "PROCESSING";
  if (lower.includes("success") || lower.includes("complete") || lower.includes("settled")) return "SUCCESS";
  if (lower.includes("fail") || lower.includes("nsf") || lower.includes("return")) return "FAILED";
  if (lower.includes("cancel") || lower.includes("skip") || lower.includes("void")) return "CANCELLED";
  return s.toUpperCase();
}

export const ramProvider: PaymentProcessor = {
  name: "RAM",

  async getEscrowBalance(externalId: string): Promise<number | null> {
    // RAM doesn't have a single-account balance endpoint exposed — fetch
    // the bulk list and filter
    const updates = await this.listUpdatedBalances(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    );
    const match = updates.find((u) => u.externalAccountId === externalId);
    return match?.balance ?? null;
  },

  async listUpdatedBalances(sinceISO: string): Promise<BalanceUpdate[]> {
    const date = sinceISO.slice(0, 10);
    const xml = await callSoap("GetUpdatedSavingDetails", `<fromDate>${date}</fromDate>`);
    const items = extractElements(xml, "CustomerSaving");
    const now = new Date();
    return items
      .map((inner) => {
        const id = extractAll(inner, "ExternalId")[0] ?? extractAll(inner, "externalId")[0];
        const bal = extractAll(inner, "Balance")[0] ?? extractAll(inner, "balance")[0];
        if (!id || !bal) return null;
        const n = Number(bal);
        if (!Number.isFinite(n)) return null;
        return { externalAccountId: id, balance: n, pulledAt: now };
      })
      .filter((x): x is BalanceUpdate => x !== null);
  },

  async getDraftUpdates(sinceISO: string): Promise<DraftUpdate[]> {
    const date = sinceISO.slice(0, 10);
    const xml = await callSoap("GetClientDrafts", `<fromDate>${date}</fromDate>`);
    const items = extractElements(xml, "Draft");
    const out: DraftUpdate[] = [];
    for (const inner of items) {
      const draftId = extractAll(inner, "DraftId")[0] ?? extractAll(inner, "draftId")[0];
      const externalAccountId = extractAll(inner, "ExternalId")[0] ?? extractAll(inner, "externalId")[0];
      const status = extractAll(inner, "Status")[0];
      if (!draftId || !externalAccountId || !status) continue;
      const amount = extractAll(inner, "Amount")[0];
      out.push({
        externalDraftId: draftId,
        externalAccountId,
        status: normalizeDraftStatus(status),
        amount: amount ? Number(amount) : null,
        scheduledDate: extractAll(inner, "ScheduledDate")[0] ?? null,
        processedAt: extractAll(inner, "ProcessedAt")[0] ?? null,
        settledAt: extractAll(inner, "SettledAt")[0] ?? null,
        returnCode: extractAll(inner, "ReturnCode")[0] ?? null,
        returnReason: extractAll(inner, "ReturnReason")[0] ?? null,
      });
    }
    return out;
  },
};
