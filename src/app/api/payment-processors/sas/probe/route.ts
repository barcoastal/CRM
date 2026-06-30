/**
 * TEMPORARY admin diagnostic — discover SAS API response shapes before building
 * the account SAS panel. Remove after the shapes are mapped.
 *
 *   GET /api/payment-processors/sas/probe?sasId=<externalSasId>
 *   GET /api/payment-processors/sas/probe?accountId=<crm account id>
 *
 * Tries a handful of likely customer/draft methods and returns the raw envelope
 * + a few sample rows for each, so we can see real field names.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sasProbe } from "@/lib/payment-processors/sas";

export async function GET(request: NextRequest) {
  const r = await requireAuthOrRespond("Modify.AllData");
  if ("response" in r) return r.response;

  const url = new URL(request.url);
  let sasId = url.searchParams.get("sasId") ?? undefined;
  const accountId = url.searchParams.get("accountId") ?? undefined;

  if (!sasId && accountId) {
    const a = await prisma.account.findUnique({ where: { id: accountId }, select: { externalSasId: true } });
    sasId = a?.externalSasId ?? undefined;
  }
  // Fall back to the first account that has a SAS id, just to get a live sample.
  if (!sasId) {
    const a = await prisma.account.findFirst({ where: { externalSasId: { not: null } }, select: { externalSasId: true } });
    sasId = a?.externalSasId ?? undefined;
  }

  const out: Record<string, unknown> = { sasIdUsed: sasId ?? null };

  // Candidate methods to discover. We pass the customer id under several common
  // param names since we don't yet know which SAS expects.
  const idParams = sasId ? { remoteid: sasId, customer_remoteid: sasId, CustomerID: sasId, RemoteID: sasId } : {};
  const probes: Array<[string, Record<string, unknown>]> = [
    ["GetBalances", {}],
    ["GetCustomerRecords", {}],
    ["GetCustomerRecords", idParams],
    ["GetCustomers", {}],
    ["GetUpdatedDebits", { SinceDate: "2020-01-01" }],
    ["GetDebits", idParams],
    ["GetCustomerDebits", idParams],
  ];

  for (const [method, body] of probes) {
    const key = `${method}${Object.keys(body).length ? "(id)" : "()"}`;
    try {
      out[key] = await sasProbe(method, body);
    } catch (e) {
      out[key] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json(out);
}
