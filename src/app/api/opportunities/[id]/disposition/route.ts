import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { OPP_STAGES, OPP_STAGE_FINAL_WIN } from "@/lib/sf-canonical";

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
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { stage, subDisposition, subject, callResult, status, description } = body ?? {};

  if (!stage || !(OPP_STAGES as readonly string[]).includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }
  if (!subDisposition || typeof subDisposition !== "string") {
    return NextResponse.json({ error: "Sub Disposition is required" }, { status: 400 });
  }

  const opp = await prisma.opportunity.findUnique({ where: { id } });
  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const oldStage = opp.stage;
  const taskStatus = STATUS_MAP[status] ?? "COMPLETED";

  const [, , task] = await prisma.$transaction([
    prisma.opportunity.update({ where: { id }, data: { stage } }),
    prisma.opportunityHistory.create({
      data: {
        opportunityId: id,
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
        opportunityId: id,
        leadId: opp.leadId,
        ownerId: session.userId,
        disposition: subDisposition,
        outcome: callResult || null,
        notes: description || null,
        completedAt: taskStatus === "COMPLETED" ? new Date() : null,
      },
    }),
  ]);

  // Auto-create Client when First Payment Completed — moves the user to "Account" land
  let redirectTo: string | undefined;
  if (stage === OPP_STAGE_FINAL_WIN) {
    const existingClient = await prisma.client.findUnique({ where: { opportunityId: id } });
    if (!existingClient && opp.leadId) {
      // Build a Client with sensible defaults; user can edit on Account page
      const today = new Date();
      const calc = await prisma.opportunityPaymentCalculation.findFirst({
        where: { opportunityId: id },
        orderBy: { savedAt: "desc" },
      });
      const programLength = calc?.programFeePeriod ?? 24;
      const totalEnrolledDebt = opp.totalDebt ?? calc?.totalDebt ?? 0;
      const monthlyPayment = totalEnrolledDebt && programLength
        ? Math.round((totalEnrolledDebt / programLength) * 100) / 100
        : 0;
      await prisma.client.create({
        data: {
          leadId: opp.leadId,
          opportunityId: id,
          programStartDate: today,
          programLength,
          monthlyPayment,
          totalEnrolledDebt,
        },
      });
    }
    if (opp.accountId) {
      redirectTo = `/accounts/${opp.accountId}`;
    }
  }

  return NextResponse.json({ ok: true, taskId: task.id, stage, redirectTo });
}
