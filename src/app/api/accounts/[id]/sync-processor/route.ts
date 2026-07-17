/**
 * "Sync to Payment Processor" - real processor enrollment. Creates the
 * client + bank account + initial debit schedule at SAS or RAM (test-mode
 * gated; see lib/payment-processors/enrollment.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { enrollClient } from "@/lib/payment-processors/enrollment";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as { processor?: "SAS" | "RAM" };
  const result = await enrollClient(id, body.processor);

  if (result.ok && result.mode === "live") {
    await prisma.accountHistory.create({
      data: {
        accountId: id,
        field: "Processor Enrollment",
        oldValue: null,
        newValue: `Enrolled with ${result.processor}`,
        changedById: session.userId,
      },
    });
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
