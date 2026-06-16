/**
 * RAM (Reliant Account Management / ramservicing.com) provider.
 *
 * Port of SF RAMApi.cls. The endpoint is a SOAP/ASMX service at
 * https://ramservicing.com/services/RAMSGatewayVer2.asmx that authenticates
 * via a StartSession call and routes operations through a `Method:` HTTP
 * header (NOT a SOAPAction header).
 *
 * Credentials come from IntegrationCredential where provider='RAM'. Falls
 * back to RAM_* env vars for local dev.
 *
 * Methods used:
 *   StartSession     (Method: GetSessionId)  -> session token (cached ~50min)
 *   GetUpdatedSavings(Method: GetUpdatedSavings) -> balance changes since
 *   GetClientList    (optional)              -> customer roster
 */

import { prisma } from "@/lib/prisma";
import type { BalanceUpdate, DraftUpdate, PaymentProcessor } from "./types";

type RamCreds = { endpoint: string; apiKey: string; affiliateId: string; feeSplitGroupId?: string };

let cachedCreds: { creds: RamCreds; expiresAt: number } | null = null;
let cachedSession: { sessionId: string; expiresAt: number } | null = null;

async function getCreds(): Promise<RamCreds> {
  if (cachedCreds && cachedCreds.expiresAt > Date.now()) return cachedCreds.creds;
  try {
    const row = await prisma.integrationCredential.findFirst({
      where: { provider: "RAM", isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (row && row.config && typeof row.config === "object") {
      const cfg = row.config as Record<string, unknown>;
      const endpoint = String(cfg.endpoint ?? cfg.RAM_API_ENDPOINT ?? "");
      const apiKey = String(cfg.apiKey ?? cfg.RAM_API_KEY ?? "");
      const affiliateId = String(cfg.affiliateId ?? cfg.RAM_AFFILIATE_ID ?? "");
      const feeSplitGroupId = cfg.feeSplitGroupId ? String(cfg.feeSplitGroupId) : undefined;
      if (endpoint && apiKey && affiliateId) {
        const creds = { endpoint, apiKey, affiliateId, feeSplitGroupId };
        cachedCreds = { creds, expiresAt: Date.now() + 60_000 };
        return creds;
      }
    }
  } catch {
    // fall through to env
  }
  const endpoint = process.env.RAM_API_ENDPOINT;
  const apiKey = process.env.RAM_API_KEY;
  const affiliateId = process.env.RAM_AFFILIATE_ID;
  if (!endpoint) throw new Error("RAM credentials not configured. Save them at /integrations or set RAM_API_ENDPOINT.");
  if (!apiKey) throw new Error("RAM_API_KEY not set");
  if (!affiliateId) throw new Error("RAM_AFFILIATE_ID not set");
  const creds = { endpoint, apiKey, affiliateId, feeSplitGroupId: process.env.RAM_FEE_SPLIT_GROUP_ID };
  cachedCreds = { creds, expiresAt: Date.now() + 60_000 };
  return creds;
}

export function clearRamCredsCache(): void {
  cachedCreds = null;
}

function escapeXml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function extractAll(xml: string, name: string): string[] {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}\\b[^>]*>([^<]*)</(?:[a-zA-Z0-9]+:)?${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function extractElements(xml: string, name: string): string[] {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

/**
 * Send a SOAP request to RAM. The endpoint dispatches on the `Method` HTTP
 * header, not on SOAPAction. The body element name matches the operation
 * (e.g. "StartSession", "GetUpdatedSavings") and lives in the
 * http://www.ramservicing.com/ namespace.
 *
 * @param bodyElement  XML element name in the SOAP body
 * @param methodHeader Value for the `Method:` HTTP header
 * @param innerXml     Inner children of the body element
 */
async function ramCall(bodyElement: string, methodHeader: string, innerXml: string): Promise<string> {
  const { endpoint } = await getCreds();
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <${bodyElement} xmlns="http://www.ramservicing.com/">
      ${innerXml}
    </${bodyElement}>
  </soap:Body>
</soap:Envelope>`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      Method: methodHeader,
    },
    body,
  });
  const xml = await res.text();
  if (!res.ok) throw new Error(`RAM ${methodHeader} HTTP ${res.status}: ${xml.slice(0, 200)}`);
  // RAM returns 200 even on Fault. Detect fault.
  if (/<soap:Fault>/i.test(xml)) {
    const msg = extractAll(xml, "faultstring")[0] ?? "unknown SOAP fault";
    throw new Error(`RAM ${methodHeader} fault: ${msg}`);
  }
  return xml;
}

async function getSessionId(): Promise<string> {
  if (cachedSession && cachedSession.expiresAt > Date.now()) return cachedSession.sessionId;
  const { apiKey } = await getCreds();
  const xml = await ramCall(
    "StartSession",
    "GetSessionId",
    `<ClientKey>${escapeXml(apiKey)}</ClientKey>`,
  );
  const sessionId = extractAll(xml, "StartSessionResult")[0];
  if (!sessionId) throw new Error("RAM StartSession returned no session id");
  cachedSession = { sessionId, expiresAt: Date.now() + 50 * 60 * 1000 };
  return sessionId;
}

function normalizeDraftStatus(s: string): string {
  const lower = (s ?? "").toLowerCase();
  if (lower.includes("schedul")) return "SCHEDULED";
  if (lower.includes("process") || lower.includes("pending")) return "PROCESSING";
  if (lower.includes("success") || lower.includes("complete") || lower.includes("settled")) return "SUCCESS";
  if (lower.includes("fail") || lower.includes("nsf") || lower.includes("return") || lower.includes("reject")) return "FAILED";
  if (lower.includes("cancel") || lower.includes("skip") || lower.includes("void")) return "CANCELLED";
  return s ? s.toUpperCase() : "SCHEDULED";
}

export const ramProvider: PaymentProcessor = {
  name: "RAM",

  async getEscrowBalance(externalId: string): Promise<number | null> {
    const updates = await this.listUpdatedBalances(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    );
    const match = updates.find((u) => u.externalAccountId === externalId);
    return match?.balance ?? null;
  },

  async listUpdatedBalances(sinceISO: string): Promise<BalanceUpdate[]> {
    const sessionId = await getSessionId();
    const fromDate = sinceISO.slice(0, 10);
    const xml = await ramCall(
      "GetUpdatedSavings",
      "GetUpdatedSavings",
      `<sessid>${escapeXml(sessionId)}</sessid><FromDate>${escapeXml(fromDate)}</FromDate>`,
    );
    // Each customer comes as a <Table> element inside <NewDataSet>.
    const rows = extractElements(xml, "Table");
    const now = new Date();
    return rows
      .map((inner) => {
        const id = extractAll(inner, "vendoraccountnumber")[0];
        const bal = extractAll(inner, "balance")[0];
        const date = extractAll(inner, "balancedate")[0];
        if (!id || bal == null) return null;
        const n = Number(bal);
        if (!Number.isFinite(n)) return null;
        const pulledAt = date ? new Date(date) : now;
        return { externalAccountId: id, balance: n, pulledAt };
      })
      .filter((x): x is BalanceUpdate => x !== null);
  },

  async getDraftUpdates(sinceISO: string): Promise<DraftUpdate[]> {
    // RAM exposes payment status via GetUpdatedPayments. The Apex equivalent
    // is in BatchGetRAMDraftUpdates. The minimum viable shape is documented
    // in the SF wrapper; the response surfaces draftid + status + amounts.
    const sessionId = await getSessionId();
    const fromDate = sinceISO.slice(0, 10);
    let xml: string;
    try {
      xml = await ramCall(
        "GetUpdatedPayments",
        "GetUpdatedPayments",
        `<sessid>${escapeXml(sessionId)}</sessid><FromDate>${escapeXml(fromDate)}</FromDate>`,
      );
    } catch {
      return []; // operation may not be exposed; balances are the primary signal
    }
    const rows = extractElements(xml, "Table");
    const out: DraftUpdate[] = [];
    for (const inner of rows) {
      const draftId = extractAll(inner, "paymentid")[0] ?? extractAll(inner, "draftid")[0];
      const externalAccountId = extractAll(inner, "vendoraccountnumber")[0];
      const status = extractAll(inner, "paymentstatus")[0] ?? extractAll(inner, "status")[0];
      if (!draftId || !externalAccountId || !status) continue;
      const amount = extractAll(inner, "amount")[0];
      out.push({
        externalDraftId: draftId,
        externalAccountId,
        status: normalizeDraftStatus(status),
        amount: amount ? Number(amount) : null,
        scheduledDate: extractAll(inner, "scheduleddate")[0] ?? null,
        processedAt: extractAll(inner, "processeddate")[0] ?? null,
        settledAt: extractAll(inner, "settleddate")[0] ?? null,
        returnCode: extractAll(inner, "returncode")[0] ?? null,
        returnReason: extractAll(inner, "returnreason")[0] ?? null,
      });
    }
    return out;
  },
};
