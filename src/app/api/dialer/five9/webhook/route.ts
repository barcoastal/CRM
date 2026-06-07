/**
 * Five9 webhook — receives call events from Five9 and writes them into
 * our Call table. Also mirrors disposition into our trigger pipeline so
 * LeadHistory + auto-archive + DNC sync run automatically.
 *
 * Port of SF Five9ConnectorService.cls.
 *
 * Configure in Five9 admin:
 *   Setup → IVR Scripts → CRM Connector → set Endpoint URL to:
 *     https://crm.coastaldebt-tools.com/api/dialer/five9/webhook
 *
 * Five9 sends application/x-www-form-urlencoded with the params named
 * in Five9ConnectorParams (ANI, dnis, agent_id, call_id, etc).
 *
 * Auth: optional header `x-five9-secret: <FIVE9_WEBHOOK_SECRET>` for
 * bot-defense; Five9 doesn't sign requests but can include a custom
 * static header.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeCtx, triggerUpdate } from "@/lib/triggers/runner";
import { addSuppression } from "@/lib/dnc";
import type { Five9CallEvent } from "@/lib/five9/types";
import { mapFive9Disposition } from "@/lib/five9/disposition-map";
import { DISPOSITION_TO_STATUS, type LeadStatusV2 } from "@/lib/sf-canonical";

function parsePhoneToLast10(raw: string | undefined): string {
  if (!raw) return "";
  const d = raw.replace(/[^0-9]/g, "");
  if (d.startsWith("1") && d.length === 11) return d.slice(1);
  return d.length > 10 ? d.slice(-10) : d;
}

function parseInt(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function handleEvent(p: Five9CallEvent, request: NextRequest): Promise<{ ok: boolean; callId?: string; message?: string }> {
  if (!p.call_id) return { ok: false, message: "call_id required" };

  // Resolve which Lead this call belongs to. Priority:
  //   1. lead_id passed by Five9 (when populated from screen-pop URL)
  //   2. Lookup by phone (ANI for inbound, DNIS for outbound)
  let leadId: string | null = p.lead_id ?? null;
  if (!leadId) {
    const phoneKey = parsePhoneToLast10(p.phone_number ?? p.ani ?? p.dnis);
    if (phoneKey) {
      const lead = await prisma.lead.findFirst({
        where: { phone: { contains: phoneKey } },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      leadId = lead?.id ?? null;
    }
  }

  // Resolve the agent — Five9 sends user_name which should match User.email or a custom mapping
  let agentId: string | null = null;
  if (p.user_name) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: p.user_name }, { email: { startsWith: `${p.user_name}@` } }],
      },
      select: { id: true },
    });
    agentId = user?.id ?? null;
  }
  if (!agentId) {
    // Fallback: any active user. We need agentId NOT NULL on the Call row.
    const fallback = await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } });
    agentId = fallback?.id ?? null;
  }
  if (!agentId) return { ok: false, message: "No agent could be resolved" };

  // Upsert by five9CallId
  const startedAt = parseDate(p.call_start_time_stamp) ?? new Date();
  const endedAt = parseDate(p.call_end_time_stamp);
  const duration = parseInt(p.call_length);

  const status = p.disposition_name
    ? "COMPLETED"
    : endedAt
      ? "COMPLETED"
      : "IN_PROGRESS";

  const callData = {
    direction: (p.call_type ?? "").toLowerCase().includes("inbound") ? "INBOUND" : "OUTBOUND",
    status,
    leadId,
    agentId,
    phoneNumber: p.phone_number ?? p.ani ?? p.dnis ?? "",
    disposition: p.disposition_name ?? null,
    duration,
    startedAt,
    endedAt,
    answeredAt: startedAt,
    five9CallId: p.call_id,
    five9SessionId: p.session_id ?? null,
    five9AgentFullName: p.agent_full_name ?? null,
    five9CampaignName: p.campaign_name ?? null,
    five9DialerGroup: p.dialer_group ?? null,
    five9DispositionName: p.disposition_name ?? null,
    five9Skill: p.skill_name ?? null,
    five9DnisAni: p.dnis ?? p.ani ?? null,
    five9CallType: p.call_type ?? null,
    five9AttemptCount: parseInt(p.attempt_count),
    five9HandleTime: parseInt(p.call_handle_time),
    five9HoldTime: parseInt(p.call_hold_time),
    five9LastDisposition: p.f9_last_disposition ?? null,
    five9LastDispositionDate: parseDate(p.f9_last_disposition_date),
  } as const;

  const call = await prisma.call.upsert({
    where: { five9CallId: p.call_id },
    create: callData,
    update: callData,
  });

  // If Five9 sent a disposition that's in our explicit FIVE9_TO_CRM_DISPOSITION
  // map, mirror it into the lead trigger pipeline (LeadHistory + auto-archive
  // + DNC sync). Everything else stays Five9-side only — the raw value is
  // still on Call.five9DispositionName for reporting.
  if (leadId && p.disposition_name) {
    const crmDisposition = mapFive9Disposition(p.disposition_name);
    if (crmDisposition) {
      const status: LeadStatusV2 = DISPOSITION_TO_STATUS[crmDisposition] ?? "Working Lead";
      const ctx = makeCtx(agentId);
      await triggerUpdate("lead", leadId, {
        status,
        lastSubDisposition: crmDisposition,
      }, ctx);

      if (crmDisposition === "DNC (Do not call)") {
        const phoneRaw = p.phone_number ?? p.ani ?? p.dnis ?? "";
        if (phoneRaw) {
          await addSuppression({
            phone: phoneRaw,
            reason: "DispositionDNC",
            source: `Five9 call ${p.call_id}`,
            leadId,
            addedById: agentId,
          }).catch(() => undefined);
        }
      }
    }
  }

  return { ok: true, callId: call.id };
}

export async function POST(request: NextRequest) {
  const required = process.env.FIVE9_WEBHOOK_SECRET;
  if (required) {
    const got = request.headers.get("x-five9-secret");
    if (got !== required) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let params: Record<string, string> = {};

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, string>;
    params = body;
  } else {
    const raw = await request.text();
    for (const [k, v] of new URLSearchParams(raw).entries()) params[k] = v;
  }

  const event: Five9CallEvent = {};
  for (const [k, v] of Object.entries(params)) {
    const key = k.toLowerCase().replace(/[ -]/g, "_");
    (event as Record<string, unknown>)[key] = v;
  }

  const result = await handleEvent(event, request);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
