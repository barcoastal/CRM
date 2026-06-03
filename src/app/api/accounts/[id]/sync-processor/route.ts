import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const acct = await prisma.account.findUnique({ where: { id } });
  if (!acct) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Mock processor sync — flip status to Active + log to history
  // TODO: wire to actual processor (RAM Payment Services or Reliant) once
  // credentials are set up on the Integration side.
  await prisma.$transaction([
    prisma.account.update({
      where: { id },
      data: { processorStatus: "Active", bankAccountSyncStatus: "Synced" },
    }),
    prisma.accountHistory.create({
      data: {
        accountId: id,
        field: "Processor Status",
        oldValue: acct.processorStatus,
        newValue: "Active",
        changedById: session.userId,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, syncedAt: new Date().toISOString() });
}
