/**
 * Live SAS detail pull for one account: customer record (status, totals, NSF
 * count, balance) + draft/payment history. Powers the account SAS panel.
 *
 *   GET /api/accounts/[id]/sas
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { getSasAccountDetails } from "@/lib/payment-processors/sas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Account.View");
  if ("response" in r) return r.response;
  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id },
    select: { sfId: true, externalSasId: true },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!account.sfId && !account.externalSasId) {
    return NextResponse.json({ linked: false, customer: null, debits: [] });
  }

  try {
    const { customer, debits } = await getSasAccountDetails({
      sfId: account.sfId,
      externalSasId: account.externalSasId,
    });
    return NextResponse.json({ linked: !!customer, customer, debits });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "SAS pull failed", customer: null, debits: [] },
      { status: 502 },
    );
  }
}
