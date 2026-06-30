/**
 * SAS (sasdashboard.com) provider.
 *
 * Port of SF SASApi.cls. The endpoint is a single ASP.NET handler that
 * dispatches on the ?Method= query string. APIKey + CompanyKey live in the
 * query string too. Response shape is always:
 *
 *   { Success, Records, Message, ProcessData (stringified JSON array) }
 *
 * Env:
 *   SAS_API_ENDPOINT=https://sasdashboard.com/modules/Pd4tnbgk/process.aspx
 *   SAS_API_KEY=<APIKey from SAS dashboard>
 *   SAS_COMPANY_KEY=<CompanyKey from SAS dashboard>
 *   SAS_SECURITY_KEY=<X-SecurityKey header, if set on the account>  (optional)
 *
 * Methods called:
 *   GetBalances           -> customer escrow balance snapshot
 *   GetCustomerRecords    -> customer profile + status
 *   GetUpdatedDebits      -> debit (draft) status changes since a date
 */

import { prisma } from "@/lib/prisma";
import type { BalanceUpdate, DraftUpdate, PaymentProcessor } from "./types";

type SasCreds = { endpoint: string; apiKey: string; companyKey: string; securityKey?: string };

let cachedCreds: { creds: SasCreds; expiresAt: number } | null = null;

/**
 * Resolve SAS credentials. Reads the active IntegrationCredential row first
 * (so the UI can manage them without redeploying); falls back to env vars for
 * local dev. Cached for 60 seconds.
 */
async function getCreds(): Promise<SasCreds> {
  if (cachedCreds && cachedCreds.expiresAt > Date.now()) return cachedCreds.creds;

  // DB-first
  try {
    const row = await prisma.integrationCredential.findFirst({
      where: { provider: "SAS", isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (row && row.config && typeof row.config === "object") {
      const cfg = row.config as Record<string, unknown>;
      const endpoint = String(cfg.endpoint ?? cfg.SAS_API_ENDPOINT ?? "");
      const apiKey = String(cfg.apiKey ?? cfg.SAS_API_KEY ?? "");
      const companyKey = String(cfg.companyKey ?? cfg.SAS_COMPANY_KEY ?? "");
      const securityKey = cfg.securityKey ? String(cfg.securityKey) : undefined;
      if (endpoint && apiKey && companyKey) {
        const creds = { endpoint, apiKey, companyKey, securityKey };
        cachedCreds = { creds, expiresAt: Date.now() + 60_000 };
        return creds;
      }
    }
  } catch {
    // fall through to env
  }

  const endpoint = process.env.SAS_API_ENDPOINT;
  const apiKey = process.env.SAS_API_KEY;
  const companyKey = process.env.SAS_COMPANY_KEY;
  if (!endpoint) throw new Error("SAS credentials not configured. Save them at /integrations or set SAS_API_ENDPOINT.");
  if (!apiKey) throw new Error("SAS_API_KEY not set");
  if (!companyKey) throw new Error("SAS_COMPANY_KEY not set");
  const creds = { endpoint, apiKey, companyKey, securityKey: process.env.SAS_SECURITY_KEY };
  cachedCreds = { creds, expiresAt: Date.now() + 60_000 };
  return creds;
}

/** Invalidate the cache after writing new creds via the UI. */
export function clearSasCredsCache(): void {
  cachedCreds = null;
}

interface SasResponse {
  RequestID?: number;
  Success: boolean;
  Records?: number;
  Message?: string | null;
  ProcessData?: string | null;
  ResponseData?: unknown;
}

interface SasBalanceRow {
  id: number;
  remoteid: string;
  current_balance: number;
  balance_earmark?: number;
  balance_in?: number;
  balance_out?: number;
}

interface SasDebitRow {
  id?: number | string;
  remoteid?: string;
  customers_id?: number | string;
  customer_remoteid?: string;
  status?: string;
  amount?: number;
  scheduled_date?: string;
  processed_date?: string;
  settled_date?: string;
  return_code?: string;
  return_reason?: string;
}

async function sasCall<T = unknown>(method: string, body: Record<string, unknown> = {}): Promise<T[]> {
  const { endpoint, apiKey, companyKey, securityKey } = await getCreds();
  const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}APIKey=${encodeURIComponent(apiKey)}&CompanyKey=${encodeURIComponent(companyKey)}&Method=${encodeURIComponent(method)}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (securityKey) headers["X-SecurityKey"] = securityKey;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`SAS ${method} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as SasResponse;
  if (!data.Success) throw new Error(`SAS ${method} returned Success=false: ${data.Message ?? "no message"}`);
  if (!data.ProcessData) return [];
  try {
    return JSON.parse(data.ProcessData) as T[];
  } catch (e) {
    throw new Error(`SAS ${method} ProcessData parse failed: ${(e as Error).message}`);
  }
}

/**
 * Raw probe of an arbitrary SAS method — returns the full envelope (Success,
 * Message, Records, and the parsed ProcessData) so we can discover the real
 * response shapes before building features. Admin/diagnostic use only.
 */
export async function sasProbe(
  method: string,
  body: Record<string, unknown> = {},
): Promise<{ ok: boolean; message: string | null; records: number | null; sample: unknown; rawProcessData: string | null }> {
  const { endpoint, apiKey, companyKey, securityKey } = await getCreds();
  const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}APIKey=${encodeURIComponent(apiKey)}&CompanyKey=${encodeURIComponent(companyKey)}&Method=${encodeURIComponent(method)}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (securityKey) headers["X-SecurityKey"] = securityKey;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let data: SasResponse;
  try {
    data = JSON.parse(text) as SasResponse;
  } catch {
    return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 300)}`, records: null, sample: null, rawProcessData: null };
  }
  let parsed: unknown = null;
  if (data.ProcessData) {
    try {
      const arr = JSON.parse(data.ProcessData) as unknown[];
      parsed = Array.isArray(arr) ? arr.slice(0, 3) : arr; // first few rows only
    } catch {
      parsed = null;
    }
  }
  return {
    ok: !!data.Success,
    message: data.Message ?? null,
    records: data.Records ?? null,
    sample: parsed,
    rawProcessData: data.ProcessData ? data.ProcessData.slice(0, 800) : null,
  };
}

function normalizeDraftStatus(s: string): string {
  const lower = (s ?? "").toLowerCase();
  if (lower.includes("schedul")) return "SCHEDULED";
  if (lower.includes("process") || lower.includes("pending")) return "PROCESSING";
  if (lower.includes("success") || lower.includes("complete") || lower.includes("settled") || lower.includes("posted")) return "SUCCESS";
  if (lower.includes("fail") || lower.includes("nsf") || lower.includes("return") || lower.includes("reject")) return "FAILED";
  if (lower.includes("cancel") || lower.includes("skip") || lower.includes("void")) return "CANCELLED";
  return s ? s.toUpperCase() : "SCHEDULED";
}

// ---- Account detail pull (powers the account SAS panel) ----------------

export interface SasCustomer {
  id: number;
  remoteid: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  display?: string;
  customerstatus?: string;
  city?: string;
  state?: string;
  postalcode?: string;
  phone1?: string;
  email?: string;
  isflagged?: boolean;
  isaudited?: boolean;
  lastaction?: string;
  totalfailed?: number; // count of failed/NSF drafts
  totaldebt?: number;
  totaldebits?: number; // total drafted to date
  totalfees?: number;
  totalcitadel?: number;
  balance?: number;
  balance_earmark?: number;
}

export interface SasDebit {
  total?: number;
  debitdate?: string;
  status?: string; // Successful | Pending | Failed/Returned ...
  reasonmessage?: string; // "ACH Cleared", NSF reason, etc.
  datecleared?: string;
  transactionid?: string;
  payouts?: number;
}

/**
 * Build the SAS filter params for one account. SAS filters GetCustomerRecords /
 * GetCustomerDebits by `RemoteID` (the Salesforce account id) or `CustomerID`
 * (the numeric SAS id). Prefer the SF id; fall back to externalSasId.
 */
function customerFilter(sfId?: string | null, externalSasId?: string | null): Record<string, string> | null {
  // SAS keys on the legacy Salesforce id (001VO...) or the numeric SAS customer
  // id, both of which we backfilled into externalSasId. The CRM's current sfId
  // is a different SF org (0018Y...) and does NOT match SAS, so only fall back
  // to it if it actually looks like a SAS-style 001 id.
  if (externalSasId) {
    if (/^\d+$/.test(externalSasId)) return { CustomerID: externalSasId };
    return { RemoteID: externalSasId };
  }
  if (sfId && sfId.startsWith("001")) return { RemoteID: sfId };
  return null;
}

/** Live pull of one account's SAS customer record + draft history. */
export async function getSasAccountDetails(args: {
  sfId?: string | null;
  externalSasId?: string | null;
}): Promise<{ customer: SasCustomer | null; debits: SasDebit[] }> {
  const filter = customerFilter(args.sfId, args.externalSasId);
  if (!filter) return { customer: null, debits: [] };

  const recs = await sasCall<SasCustomer>("GetCustomerRecords", filter).catch(() => [] as SasCustomer[]);
  // A matched filter returns exactly one row; a missed filter returns the full
  // (paginated) list — never show that, it would be the wrong customer.
  const customer = recs.length === 1 ? recs[0] : null;

  const debits = await sasCall<SasDebit>("GetCustomerDebits", filter).catch(() => [] as SasDebit[]);
  // Newest first.
  debits.sort((a, b) => String(b.debitdate ?? "").localeCompare(String(a.debitdate ?? "")));

  return { customer, debits };
}

export const sasProvider: PaymentProcessor = {
  name: "SAS",

  async getEscrowBalance(externalId: string): Promise<number | null> {
    const rows = await sasCall<SasBalanceRow>("GetBalances", {});
    const match = rows.find((r) => String(r.id) === externalId || r.remoteid === externalId);
    return match ? Number(match.current_balance ?? 0) : null;
  },

  async listUpdatedBalances(_sinceISO: string): Promise<BalanceUpdate[]> {
    // GetBalances returns the FULL set on each call. We accept that cost: the
    // SF batch job did the same. The caller passes sinceISO for parity with
    // the RAM provider but SAS doesn't filter by date for balance reads.
    void _sinceISO;
    const rows = await sasCall<SasBalanceRow>("GetBalances", {});
    const now = new Date();
    return rows
      .filter((r) => r.remoteid && typeof r.current_balance === "number")
      .map((r) => ({
        // We key on the SF Account ID since that's what our Account.externalSasId
        // historically stored (SF's External_SAS_Id__c). The numeric SAS id
        // also matches because our backfill populated externalSasId from the
        // SF mirror, which was the numeric id. Try both during lookup.
        externalAccountId: r.remoteid,
        balance: Number(r.current_balance),
        pulledAt: now,
      }));
  },

  async getDraftUpdates(sinceISO: string): Promise<DraftUpdate[]> {
    const date = sinceISO.slice(0, 10);
    const rows = await sasCall<SasDebitRow>("GetUpdatedDebits", { SinceDate: date });
    return rows.map((d) => ({
      externalDraftId: String(d.id ?? d.remoteid ?? ""),
      externalAccountId: String(d.customer_remoteid ?? d.customers_id ?? ""),
      status: normalizeDraftStatus(String(d.status ?? "")),
      amount: d.amount != null ? Number(d.amount) : null,
      scheduledDate: d.scheduled_date ?? null,
      processedAt: d.processed_date ?? null,
      settledAt: d.settled_date ?? null,
      returnCode: d.return_code ?? null,
      returnReason: d.return_reason ?? null,
    }));
  },
};
