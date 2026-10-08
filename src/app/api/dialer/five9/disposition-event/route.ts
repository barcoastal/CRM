/** Receives the pilot campaign's silent Five9 "On Call Dispositioned" connector. */
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeCtx, triggerUpdate } from "@/lib/triggers/runner";
import { mapFive9Disposition } from "@/lib/five9/disposition-map";
import { DISPOSITION_TO_STATUS } from "@/lib/sf-canonical";
import { addSuppression } from "@/lib/dnc";

const PILOT_CAMPAIGN = "Bar1 CRM Frame Pilot";

function authorized(received: string): boolean {
  const expected = process.env.FIVE9_DISPOSITION_TOKEN;
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function last10(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

function snapshot(raw: string | null): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function parameters(request: NextRequest): Promise<Record<string, string>> {
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    const body: unknown = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) return {};
    return Object.fromEntries(Object.entries(body).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  }
  const form = await request.formData().catch(() => new FormData());
  return Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

export async function POST(request: NextRequest) {
  const p = await parameters(request);
  if (!authorized(p.token ?? "")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callId = p.call_id?.trim();
  const phone = p.number?.trim();
  const disposition = p.disposition_name?.trim();
  const login = p.user_name?.trim();
  if (p.campaign_name !== PILOT_CAMPAIGN || !callId || !phone || !disposition || !login ||
      callId.length > 80 || disposition.length > 200 || last10(phone).length !== 10) {
    return NextResponse.json({ error: "Invalid Five9 event" }, { status: 400 });
  }

  const pilotEmails = (process.env.FIVE9_FRAME_PILOT_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const agent = await prisma.user.findFirst({
    where: {
      isActive: true,
      email: { in: pilotEmails, mode: "insensitive" },
      OR: [{ five9Username: { equals: login, mode: "insensitive" } }, { email: { equals: login, mode: "insensitive" } }],
    },
    select: { id: true },
  });
  if (!agent) return NextResponse.json({ error: "Pilot agent not found" }, { status: 403 });

  const priorCall = await prisma.call.findUnique({ where: { five9CallId: callId }, select: { leadId: true } });
  let leadId = priorCall?.leadId ?? null;
  let ambiguous = false;
  if (!leadId) {
    // Match the contact number exactly after normalizing formatting. A phone
    // can belong to several CRM leads; never silently disposition the first.
    const matches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Lead"
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${last10(phone)}
      LIMIT 2
    `;
    leadId = matches.length === 1 ? matches[0].id : null;
    ambiguous = matches.length > 1;
  }

  await prisma.call.upsert({
    where: { five9CallId: callId },
    create: {
      five9CallId: callId, agentId: agent.id, leadId, phoneNumber: phone,
      direction: "OUTBOUND", status: "COMPLETED", disposition,
      five9DispositionName: disposition, five9CampaignName: PILOT_CAMPAIGN,
      five9CallType: "Manual", startedAt: new Date(), endedAt: new Date(),
    },
    update: { leadId, disposition, five9DispositionName: disposition, status: "COMPLETED", endedAt: new Date() },
  });

  if (!leadId) return NextResponse.json({ ok: true, updatedLead: false, reason: ambiguous ? "multiple_leads" : "no_lead" });

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { sfDataJson: true } });
  if (!lead) return NextResponse.json({ ok: true, updatedLead: false, reason: "no_lead" });
  const sf = snapshot(lead.sfDataJson);
  if (sf.five9_Disposition__c === disposition) return NextResponse.json({ ok: true, updatedLead: true });

  const crmDisposition = mapFive9Disposition(disposition);
  sf.five9_Disposition__c = disposition;
  if (crmDisposition) sf.Sub_Disposition__c = crmDisposition;
  await triggerUpdate("lead", leadId, {
    sfDataJson: JSON.stringify(sf),
    lastContactedAt: new Date(),
    ...(crmDisposition ? { status: DISPOSITION_TO_STATUS[crmDisposition] ?? "Working Lead" } : {}),
  }, makeCtx(agent.id));

  if (crmDisposition === "DNC (Do not call)") {
    await addSuppression({ phone, reason: "DispositionDNC", source: `Five9 call ${callId}`, leadId, addedById: agent.id }).catch(() => undefined);
  }
  return NextResponse.json({ ok: true, updatedLead: true });
}
