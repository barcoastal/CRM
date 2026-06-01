import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { updateDraftSchema } from "@/lib/validations/draft";
import { nextDraftStatus, DraftTransitionError, type DraftStatus } from "@/lib/draft-state-machine";
import { auditWrite } from "@/lib/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Draft.View");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const draft = await prisma.draft.findUnique({
    where: { id },
    include: {
      programPlan: { select: { id: true, accountId: true, monthlyAmount: true } },
      retries: true,
      parentDraft: true,
    },
  });
  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(draft);
}

/**
 * PATCH supports two modes:
 *  - { status: "PROCESSING" }  → state-machine transition (validated)
 *  - { scheduledDate, notes, returnCode, returnReason } → non-status mutations
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Draft.Retry");
  if ("response" in r) return r.response;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = updateDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const before = await prisma.draft.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (d.status) {
    // Map the requested target status to an event the state machine accepts
    const eventByTarget: Record<DraftStatus, Parameters<typeof nextDraftStatus>[1]["type"]> = {
      SCHEDULED: "SCHEDULE_RETRY", // no direct path; treat as restart
      PROCESSING: "RUN",
      SUCCESS: "WEBHOOK_SUCCESS",
      FAILED: "WEBHOOK_FAILURE",
      RETRYING: "SCHEDULE_RETRY",
      CANCELLED: "CANCEL",
    };
    try {
      const next = nextDraftStatus(before.status as DraftStatus, { type: eventByTarget[d.status] } as { type: "RUN" | "WEBHOOK_SUCCESS" | "WEBHOOK_FAILURE" | "CANCEL" | "SCHEDULE_RETRY" });
      if (next !== d.status) {
        return NextResponse.json({ error: `Transition leads to ${next}, not ${d.status}` }, { status: 409 });
      }
      data.status = d.status;
      if (d.status === "PROCESSING") data.processedAt = new Date();
      if (d.status === "SUCCESS") data.settledAt = new Date();
    } catch (e) {
      if (e instanceof DraftTransitionError) {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
      throw e;
    }
  }
  if (d.scheduledDate) data.scheduledDate = new Date(d.scheduledDate);
  if (d.returnCode !== undefined) data.returnCode = d.returnCode;
  if (d.returnReason !== undefined) data.returnReason = d.returnReason;
  if (d.notes !== undefined) data.notes = d.notes;

  const draft = await prisma.draft.update({ where: { id }, data });
  await auditWrite({
    userId: r.session.userId, entity: "Draft", entityId: id, action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: draft as unknown as Record<string, unknown>,
  }).catch(() => null);
  return NextResponse.json(draft);
}
