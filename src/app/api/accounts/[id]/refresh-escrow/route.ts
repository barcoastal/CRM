import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { getProvider } from "@/lib/payment-processors";

/**
 * Manual per-account escrow refresh — used by the "Refresh Escrow" button
 * on the Account header. Calls the chosen processor for a single Account.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { id } = await params;

  const acct = await prisma.account.findUnique({
    where: { id },
    select: {
      externalSasId: true,
      externalRamId: true,
      paymentProcessor: true,
    },
  });
  if (!acct) return ssnSafeJson({ error: "Not found" }, { status: 404 });

  const procName = (acct.paymentProcessor ?? (acct.externalSasId ? "SAS" : acct.externalRamId ? "RAM" : null)) as
    | "SAS"
    | "RAM"
    | "RELIANT"
    | null;
  const externalId = procName === "SAS" ? acct.externalSasId : acct.externalRamId;
  if (!procName || !externalId) {
    return ssnSafeJson({ error: "Account has no processor / external id set" }, { status: 400 });
  }

  try {
    const balance = await getProvider(procName).getEscrowBalance(externalId);
    if (balance == null) {
      return ssnSafeJson({ ok: false, error: "Processor returned no balance" }, { status: 502 });
    }
    const now = new Date();
    await prisma.account.update({
      where: { id },
      data: { escrowBalance: balance, escrowPulledAt: now },
    });
    return ssnSafeJson({ ok: true, balance, pulledAt: now.toISOString() });
  } catch (e: unknown) {
    return ssnSafeJson({ error: e instanceof Error ? e.message : "Refresh failed" }, { status: 500 });
  }
}
