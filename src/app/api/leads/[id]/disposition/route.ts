import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { LEAD_STATUSES } from "@/lib/sf-canonical";

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
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const { session } = r;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { stage, subDisposition, subject, callResult, status, description } = body ?? {};

  if (!stage || typeof stage !== "string" || !(LEAD_STATUSES as readonly string[]).includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }
  if (!subDisposition || typeof subDisposition !== "string") {
    return NextResponse.json({ error: "Sub Disposition is required" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const oldStatus = lead.status;
  const taskStatus = STATUS_MAP[status] ?? "COMPLETED";

  const [, , task] = await prisma.$transaction([
    prisma.lead.update({
      where: { id },
      data: {
        status: stage,
        lastContactedAt: new Date(),
      },
    }),
    prisma.leadHistory.create({
      data: {
        leadId: id,
        field: "Status",
        oldValue: oldStatus,
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
        leadId: id,
        ownerId: session.userId,
        disposition: subDisposition,
        outcome: callResult || null,
        notes: description || null,
        completedAt: taskStatus === "COMPLETED" ? new Date() : null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, taskId: task.id, status: stage });
}
