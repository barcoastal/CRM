import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { LEAD_STATUSES } from "@/lib/sf-canonical";
import { convertLead } from "@/lib/lead-conversion";
import { makeCtx, triggerUpdate } from "@/lib/triggers/runner";

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

  // Create the disposition Task first so the LeadTrigger sees it and
  // skips its own status-change Task creation (avoids dupes).
  const task = await prisma.task.create({
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
  });

  // Stamp sub-disposition into sfDataJson so the LeadTrigger can roll the
  // previous value into Last_Sub_Disposition__c (SF parity).
  let sfData: Record<string, unknown> = {};
  try {
    sfData = lead.sfDataJson ? JSON.parse(lead.sfDataJson) as Record<string, unknown> : {};
  } catch {
    sfData = {};
  }
  sfData.Sub_Disposition__c = subDisposition;

  // Update the Lead through the trigger runner -> fires the LeadTrigger,
  // which writes Lead.lastDisposition / lastDispositionAt and creates the
  // LeadHistory entry automatically.
  const ctx = makeCtx(session.userId, [`Lead:${id}:task`]);
  await triggerUpdate("lead", id, {
    status: stage,
    lastContactedAt: new Date(),
    sfDataJson: JSON.stringify(sfData),
  }, ctx);

  // Auto-convert to Opportunity when stage flips to "Converted"
  let conversion: { accountId: string; contactId: string; opportunityId: string | null } | null = null;
  if (stage === "Converted") {
    try {
      const result = await convertLead(id, {
        opportunityRecordType: "DEBT_SETTLEMENT",
        accountOwnerId: lead.assignedToId ?? session.userId,
        performedById: session.userId,
      });
      conversion = {
        accountId: result.accountId,
        contactId: result.contactId,
        opportunityId: result.opportunityId,
      };
    } catch (e) {
      // Surface the conversion failure but don't roll back the disposition save
      const msg = e instanceof Error ? e.message : "conversion failed";
      return NextResponse.json({
        ok: true,
        taskId: task.id,
        status: stage,
        conversionError: msg,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    taskId: task.id,
    status: stage,
    conversion,
  });
}
