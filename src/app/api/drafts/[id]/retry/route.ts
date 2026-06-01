import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { computeNextRetryDate, shouldRetry } from "@/lib/draft-state-machine";

/**
 * Create a retry Draft for a failed Draft. The original stays in FAILED;
 * a new child Draft is created in SCHEDULED state with attemptNumber + 1
 * and parentDraftId pointing at the original.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Draft.Retry");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const parent = await prisma.draft.findUnique({ where: { id } });
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (parent.status !== "FAILED") {
    return NextResponse.json({ error: `Can only retry FAILED drafts (current: ${parent.status})` }, { status: 409 });
  }
  if (!shouldRetry({ attemptNumber: parent.attemptNumber, maxAttempts: parent.maxAttempts, returnCode: parent.returnCode })) {
    return NextResponse.json({ error: "Retry not allowed (max attempts or hard return code)" }, { status: 409 });
  }

  const nextDate = computeNextRetryDate({
    attemptNumber: parent.attemptNumber,
    maxAttempts: parent.maxAttempts,
    lastFailureDate: parent.processedAt ?? parent.updatedAt,
  });
  if (!nextDate) return NextResponse.json({ error: "No retry date available" }, { status: 409 });

  const retry = await prisma.draft.create({
    data: {
      programPlanId: parent.programPlanId,
      debitScheduleId: parent.debitScheduleId,
      scheduledDate: nextDate,
      amount: parent.amount,
      status: "SCHEDULED",
      attemptNumber: parent.attemptNumber + 1,
      maxAttempts: parent.maxAttempts,
      parentDraftId: parent.id,
    },
  });
  return NextResponse.json(retry, { status: 201 });
}
