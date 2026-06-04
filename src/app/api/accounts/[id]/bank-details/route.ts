import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { makeCtx, triggerUpdate } from "@/lib/triggers/runner";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const acct = await prisma.account.findUnique({ where: { id } });
  if (!acct) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { bankName, bankRoutingNumber, bankAccountNumber, bankAccountType } = body ?? {};

  const updates: Record<string, string | null> = {};
  const history: { field: string; oldValue: string | null; newValue: string | null }[] = [];

  if (typeof bankName === "string" && bankName !== acct.bankName) {
    updates.bankName = bankName || null;
    history.push({ field: "Bank Name", oldValue: acct.bankName, newValue: bankName || null });
  }
  if (typeof bankRoutingNumber === "string" && bankRoutingNumber !== acct.bankRoutingNumber) {
    updates.bankRoutingNumber = bankRoutingNumber || null;
    history.push({ field: "Bank Routing Number", oldValue: acct.bankRoutingNumber, newValue: bankRoutingNumber || null });
  }
  if (typeof bankAccountNumber === "string" && bankAccountNumber !== acct.bankAccountNumber) {
    updates.bankAccountNumber = bankAccountNumber || null;
    history.push({ field: "Bank Account Number", oldValue: acct.bankAccountNumber, newValue: bankAccountNumber || null });
  }
  if (typeof bankAccountType === "string" && bankAccountType !== acct.bankAccountType) {
    updates.bankAccountType = bankAccountType || null;
    history.push({ field: "Bank Account Type", oldValue: acct.bankAccountType, newValue: bankAccountType || null });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, changed: false });
  }

  // accountTrigger flips bankAccountSyncStatus + processorStatus to "Sync Pending"
  // automatically when any bank field changes (via beforeUpdate hook).
  const ctx = makeCtx(session.userId);
  await triggerUpdate("account", id, updates, ctx);

  // Explicit per-field history rows
  await Promise.all(
    history.map((h) =>
      prisma.accountHistory.create({
        data: { accountId: id, ...h, changedById: session.userId },
      })
    )
  );

  return NextResponse.json({ ok: true, changed: true });
}
