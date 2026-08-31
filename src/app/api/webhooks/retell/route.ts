import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addSuppression } from "@/lib/dnc";
import { outcomeFromRetell, type RetellCall, verifyRetellWebhook } from "@/lib/ai-dialer/retell";
import { Prisma } from "@/generated/prisma/client";

type Payload = { event: string; call: RetellCall };

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-retell-signature");
  if (!verifyRetellWebhook(raw, signature)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let payload: Payload;
  try { payload = JSON.parse(raw) as Payload; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!payload.call?.call_id) return NextResponse.json({ error: "Missing call ID" }, { status: 400 });

  const existing = await prisma.aiCall.findUnique({
    where: { retellCallId: payload.call.call_id }, include: { lead: true },
  });
  if (!existing) return new NextResponse(null, { status: 204 });
  const analysis = payload.call.call_analysis ?? null;
  const custom = (analysis?.custom_analysis_data ?? {}) as Record<string, unknown>;
  const meetingText = typeof custom.meeting_start === "string" ? custom.meeting_start : null;
  const meetingAt = meetingText && !Number.isNaN(Date.parse(meetingText)) ? new Date(meetingText) : undefined;
  const outcome = outcomeFromRetell(payload.call);
  const status = payload.event === "call_started" ? "IN_PROGRESS"
    : payload.event === "call_analyzed" ? "ANALYZED"
      : payload.event === "call_ended" ? "ENDED" : existing.status;
  const transferred = payload.event === "transfer_bridged" || existing.transferred || outcome === "TRANSFERRED";

  await prisma.$transaction(async (tx) => {
    await tx.aiCall.update({
      where: { id: existing.id },
      data: {
        status, outcome: outcome ?? existing.outcome,
        disconnectionReason: payload.call.disconnection_reason ?? existing.disconnectionReason,
        durationMs: payload.call.duration_ms ?? existing.durationMs,
        transcript: payload.call.transcript ?? existing.transcript,
        summary: typeof analysis?.call_summary === "string" ? analysis.call_summary : existing.summary,
        analysis: analysis ? analysis as Prisma.InputJsonValue : undefined,
        transferred,
        meetingAt: meetingAt ?? existing.meetingAt,
        startedAt: payload.call.start_timestamp ? new Date(payload.call.start_timestamp) : existing.startedAt,
        endedAt: payload.call.end_timestamp ? new Date(payload.call.end_timestamp) : existing.endedAt,
      },
    });
    if (existing.campaignId && ["ANALYZED", "ENDED"].includes(status)) {
      await tx.campaignContact.updateMany({
        where: { campaignId: existing.campaignId, leadId: existing.leadId },
        data: { status: outcome === "NO_ANSWER" || outcome === "VOICEMAIL" ? "IN_PROGRESS" : "COMPLETED" },
      });
    }
    await tx.webhookEvent.create({ data: {
      source: "RETELL", endpoint: "/api/webhooks/retell", signature,
      signatureValid: true, payload: payload as unknown as Prisma.InputJsonValue, status: "PROCESSED", processedAt: new Date(),
      resultNote: `${payload.event}:${payload.call.call_id}`,
    } });
  });
  if (outcome === "DNC") {
    await addSuppression({
      phone: existing.toNumber, reason: "RegulatoryDNC", source: "Retell AI voice opt-out",
      leadId: existing.leadId, notes: `Opt-out captured on AI call ${existing.retellCallId}`,
    });
    await prisma.lead.update({ where: { id: existing.leadId }, data: { status: "DNC", aiCallConsent: false } });
  }
  return new NextResponse(null, { status: 204 });
}
