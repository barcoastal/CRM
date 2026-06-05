/**
 * Set the Five9 disposition on a call, then optionally mirror through the
 * CRM lead disposition pipeline if the Five9 disposition maps to a CRM one.
 *
 *   POST /api/dialer/five9/agent/set-disposition
 *     body: { callId, dispositionName, notes?, leadId? }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setCallDisposition } from "@/lib/five9/agent-api";
import { mapFive9Disposition } from "@/lib/five9/disposition-map";
import { makeCtx, triggerUpdate } from "@/lib/triggers/runner";
import { DISPOSITION_TO_STATUS, type LeadStatusV2 } from "@/lib/sf-canonical";
import { addSuppression } from "@/lib/dnc";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    callId?: string;
    dispositionName?: string;
    notes?: string;
    leadId?: string;
  };
  if (!body.callId || !body.dispositionName) {
    return NextResponse.json({ error: "callId and dispositionName required" }, { status: 400 });
  }

  // 1. Save to Five9
  try {
    await setCallDisposition(session.user.id, body.callId, body.dispositionName, body.notes);
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fail" },
      { status: 502 },
    );
  }

  // 2. Update our local Call row
  const call = await prisma.call.findFirst({
    where: { five9CallId: body.callId },
    select: { id: true, leadId: true, phoneNumber: true },
  });
  if (call) {
    await prisma.call.update({
      where: { id: call.id },
      data: {
        disposition: body.dispositionName,
        five9DispositionName: body.dispositionName,
        status: "COMPLETED",
        endedAt: new Date(),
      },
    });
  }

  // 3. If the disposition maps to CRM and we have a lead, fire the pipeline
  const crmDispo = mapFive9Disposition(body.dispositionName);
  const leadId = body.leadId ?? call?.leadId ?? null;
  let mirrored = false;
  if (crmDispo && leadId) {
    const status: LeadStatusV2 = DISPOSITION_TO_STATUS[crmDispo] ?? "Working Lead";
    await triggerUpdate(
      "lead",
      leadId,
      { status, lastSubDisposition: crmDispo },
      makeCtx(session.user.id),
    );
    if (crmDispo === "DNC (Do not call)" && call?.phoneNumber) {
      await addSuppression({
        phone: call.phoneNumber,
        reason: "DispositionDNC",
        source: `Five9 dialer ${body.callId}`,
        leadId,
        addedById: session.user.id,
      }).catch(() => undefined);
    }
    mirrored = true;
  }

  return NextResponse.json({ ok: true, crmDispo, mirrored });
}
