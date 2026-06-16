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

function normalizeDraftStatus(s: string): string {
  const lower = (s ?? "").toLowerCase();
  if (lower.includes("schedul")) return "SCHEDULED";
  if (lower.includes("process") || lower.includes("pending")) return "PROCESSING";
  if (lower.includes("success") || lower.includes("complete") || lower.includes("settled") || lower.includes("posted")) return "SUCCESS";
  if (lower.includes("fail") || lower.includes("nsf") || lower.includes("return") || lower.includes("reject")) return "FAILED";
  if (lower.includes("cancel") || lower.includes("skip") || lower.includes("void")) return "CANCELLED";
  return s ? s.toUpperCase() : "SCHEDULED";
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
