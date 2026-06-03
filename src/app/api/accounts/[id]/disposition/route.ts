import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { ACCOUNT_STAGES } from "@/lib/sf-canonical";

const STATUS_MAP: Record<string, string> = {
  "Completed": "COMPLETED",
  "Not Started": "NOT_STARTED",
  "In Progress": "IN_PROGRESS",
  "Waiting on someone else": "WAITING",
  "Deferred": "DEFERRED",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { stage, subDisposition, subject, callResult, status, description } = body ?? {};

  if (!stage || !(ACCOUNT_STAGES as readonly string[]).includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }
  if (!subDisposition || typeof subDisposition !== "string") {
    return NextResponse.json({ error: "Sub Disposition is required" }, { status: 400 });
  }

  const acct = await prisma.account.findUnique({ where: { id } });
  if (!acct) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const oldStage = acct.stage;
  const taskStatus = STATUS_MAP[status] ?? "COMPLETED";

  const [, , task] = await prisma.$transaction([
    prisma.account.update({ where: { id }, data: { stage } }),
    prisma.accountHistory.create({
      data: {
        accountId: id,
        field: "Stage",
        oldValue: oldStage,
        newValue: stage,
        changedById: session.userId,
      },
    }),
    prisma.task.create({
      data: {
        recordType: "DISPOSITION",
        subject: subject || stage,
        type: "CALL",
        status: taskStatus,
        accountId: id,
        ownerId: session.userId,
        disposition: subDisposition,
        outcome: callResult || null,
        notes: description || null,
        completedAt: taskStatus === "COMPLETED" ? new Date() : null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, taskId: task.id, stage });
}
