/**
 * SAS (Smart Account Servicing) provider.
 *
 * Port of SF SASApi.cls — REST API with bearer-token auth.
 *
 * Env:
 *   SAS_API_BASE_URL=https://api.smartaccountservicing.com
 *   SAS_API_KEY=<bearer token from SAS portal>
 *   SAS_AFFILIATE_ID=<your affiliate id>     (some SAS endpoints require this)
 *
 * Endpoints used:
 *   GET  /customers/{externalId}            → returns { balance, status, ... }
 *   GET  /customers/updated?since=ISO       → list of customer summaries
 *   GET  /drafts/updated?since=ISO          → list of recent draft status changes
 */

import type { BalanceUpdate, DraftUpdate, PaymentProcessor } from "./types";

interface SASCustomerSummary {
  customer_id: string;
  balance: number;
  status?: string;
  updated_at?: string;
}

interface SASDraftSummary {
  draft_id: string;
  customer_id: string;
  status: string;
  amount?: number;
  scheduled_date?: string;
  processed_at?: string;
  settled_at?: string;
  return_code?: string;
  return_reason?: string;
}

function getEnv(): { base: string; key: string } {
  const base = process.env.SAS_API_BASE_URL;
  const key = process.env.SAS_API_KEY;
  if (!base) throw new Error("SAS_API_BASE_URL not set");
  if (!key) throw new Error("SAS_API_KEY not set");
  return { base, key };
}

async function sasFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const { base, key } = getEnv();
  const url = new URL(path, base);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SAS ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function normalizeDraftStatus(s: string): string {
  const lower = s.toLowerCase();
  if (lower.includes("schedul")) return "SCHEDULED";
  if (lower.includes("process")) return "PROCESSING";
  if (lower.includes("success") || lower.includes("complete")) return "SUCCESS";
  if (lower.includes("fail") || lower.includes("nsf") || lower.includes("return")) return "FAILED";
  if (lower.includes("cancel") || lower.includes("skip")) return "CANCELLED";
  return s.toUpperCase();
}

export const sasProvider: PaymentProcessor = {
  name: "SAS",

  async getEscrowBalance(externalId: string): Promise<number | null> {
    try {
      const data = await sasFetch<SASCustomerSummary>(`/customers/${encodeURIComponent(externalId)}`);
      return typeof data.balance === "number" ? data.balance : null;
    } catch {
      return null;
    }
  },

  async listUpdatedBalances(sinceISO: string): Promise<BalanceUpdate[]> {
    const data = await sasFetch<{ customers: SASCustomerSummary[] }>("/customers/updated", {
      since: sinceISO,
    });
    const now = new Date();
    return (data.customers ?? [])
      .filter((c) => c.customer_id && typeof c.balance === "number")
      .map((c) => ({
        externalAccountId: c.customer_id,
        balance: c.balance,
        pulledAt: c.updated_at ? new Date(c.updated_at) : now,
      }));
  },

  async getDraftUpdates(sinceISO: string): Promise<DraftUpdate[]> {
    const data = await sasFetch<{ drafts: SASDraftSummary[] }>("/drafts/updated", {
      since: sinceISO,
    });
    return (data.drafts ?? []).map((d) => ({
      externalDraftId: d.draft_id,
      externalAccountId: d.customer_id,
      status: normalizeDraftStatus(d.status ?? ""),
      amount: d.amount ?? null,
      scheduledDate: d.scheduled_date ?? null,
      processedAt: d.processed_at ?? null,
      settledAt: d.settled_at ?? null,
      returnCode: d.return_code ?? null,
      returnReason: d.return_reason ?? null,
    }));
  },
};
