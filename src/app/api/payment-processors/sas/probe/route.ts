/**
 * TEMPORARY admin diagnostic — discover SAS API response shapes / filter params
 * before building the account SAS panel. Remove after the shapes are mapped.
 *
 * Default (no method): runs a fixed set of discovery probes.
 *
 * Query-driven single call:
 *   /api/payment-processors/sas/probe?method=GetCustomerRecords&p.CustomerID=2113
 *   Any query param prefixed "p." becomes a SAS body field (p.CustomerID -> CustomerID).
 *
 * Helpers:
 *   ?accountId=<crm id>  -> resolves that account's externalSasId for context
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sasProbe } from "@/lib/payment-processors/sas";

export async function GET(request: NextRequest) {
  const r = await requireAuthOrRespond("Modify.AllData");
  if ("response" in r) return r.response;

  const url = new URL(request.url);
  const method = url.searchParams.get("method");

  // Single query-driven call
  if (method) {
    const body: Record<string, unknown> = {};
    for (const [k, v] of url.searchParams.entries()) {
      if (k.startsWith("p.")) body[k.slice(2)] = v;
    }
    const result = await sasProbe(method, body).catch((e) => ({ error: String(e) }));
    return NextResponse.json({ method, body, result });
  }

  // Default discovery set
  let sasId = url.searchParams.get("sasId") ?? undefined;
  const accountId = url.searchParams.get("accountId") ?? undefined;
  if (!sasId && accountId) {
    const a = await prisma.account.findUnique({ where: { id: accountId }, select: { externalSasId: true } });
    sasId = a?.externalSasId ?? undefined;
  }
  if (!sasId) {
    const a = await prisma.account.findFirst({ where: { externalSasId: { not: null } }, select: { externalSasId: true } });
    sasId = a?.externalSasId ?? undefined;
  }
  const out: Record<string, unknown> = { sasIdUsed: sasId ?? null };
  const idParams = sasId ? { remoteid: sasId, customer_remoteid: sasId, CustomerID: sasId, RemoteID: sasId } : {};
  const probes: Array<[string, Record<string, unknown>]> = [
    ["GetBalances", {}],
    ["GetCustomerRecords", idParams],
    ["GetCustomerDebits", idParams],
  ];
  for (const [m, body] of probes) {
    out[`${m}${Object.keys(body).length ? "(id)" : "()"}`] = await sasProbe(m, body).catch((e) => ({ error: String(e) }));
  }
  return NextResponse.json(out);
}
