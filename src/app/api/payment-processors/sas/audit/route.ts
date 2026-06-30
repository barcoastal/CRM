/**
 * TEMPORARY admin audit — SAS<->CRM linkage coverage + sample linked accounts
 * that have a positive balance (for testing the SAS panel). Remove later.
 *
 *   GET /api/payment-processors/sas/audit
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { getAllSasBalances } from "@/lib/payment-processors/sas";

export async function GET() {
  const r = await requireAuthOrRespond("Modify.AllData");
  if ("response" in r) return r.response;

  const balances = await getAllSasBalances();
  const withMoney = balances.filter((b) => Number(b.current_balance) > 0);

  // Linkage coverage across CRM accounts.
  const accountsTotal = await prisma.account.count();
  const accountsLinked = await prisma.account.count({ where: { externalSasId: { not: null } } });

  // Map SAS rows with money -> CRM accounts. externalSasId may hold the numeric
  // SAS id OR the legacy remoteid, so match on both.
  const keys = withMoney.flatMap((b) => [b.remoteid, String(b.id)]).filter(Boolean);
  const linkedAccounts = await prisma.account.findMany({
    where: { externalSasId: { in: keys } },
    select: { id: true, name: true, externalSasId: true, escrowBalance: true },
    take: 25,
  });

  // Attach the live SAS balance to each matched account.
  const byKey = new Map<string, number>();
  for (const b of withMoney) {
    byKey.set(b.remoteid, Number(b.current_balance));
    byKey.set(String(b.id), Number(b.current_balance));
  }
  const samples = linkedAccounts
    .map((a) => ({ id: a.id, name: a.name, sasBalance: a.externalSasId ? byKey.get(a.externalSasId) ?? null : null }))
    .sort((x, y) => (y.sasBalance ?? 0) - (x.sasBalance ?? 0));

  return NextResponse.json({
    sasCustomersTotal: balances.length,
    sasCustomersWithMoney: withMoney.length,
    crmAccountsTotal: accountsTotal,
    crmAccountsLinked: accountsLinked,
    linkedAccountsWithMoney: samples.length,
    samples,
  });
}
