import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { assertAiCallAllowed } from "@/lib/ai-dialer/compliance";
import { createRetellCall } from "@/lib/ai-dialer/retell";
import { Prisma } from "@/generated/prisma/client";

const schema = z.object({ limit: z.number().int().min(1).max(100).default(10) });

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw new Error("Lead phone is not a valid US number");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthOrRespond("Integration.Manage");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid launch request", details: parsed.error.flatten() }, { status: 400 });
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (!campaign.aiEnabled || campaign.dialerMode !== "AI" || !campaign.aiAgentId) {
    return NextResponse.json({ error: "Campaign must use AI mode, be AI-enabled, and have a Retell agent ID" }, { status: 409 });
  }

  const active = await prisma.aiCall.count({ where: { campaignId: id, status: { in: ["REGISTERED", "IN_PROGRESS"] } } });
  const capacity = Math.max(0, Math.min(parsed.data.limit, campaign.aiMaxConcurrency, 100) - active);
  if (!capacity) return NextResponse.json({ launched: 0, active, capacity: 0, skipped: [] });
  const contacts = await prisma.campaignContact.findMany({
    where: { campaignId: id, status: "PENDING" }, include: { lead: true },
    orderBy: { priority: "desc" }, take: capacity * 3,
  });
  const numbers = await prisma.aiOutboundNumber.findMany({
    where: { isActive: true }, orderBy: { priority: "desc" },
  });
  const launched: Array<{ leadId: string; retellCallId: string }> = [];
  const skipped: Array<{ leadId: string; reason: string }> = [];

  for (const contact of contacts) {
    if (launched.length >= capacity) break;
    try {
      await assertAiCallAllowed(contact.lead, campaign);
      const from = numbers.find((n) => n.state === contact.lead.state?.toUpperCase()) ?? numbers.find((n) => !n.state);
      if (!from) throw new Error(`No active caller ID is configured for ${contact.lead.state ?? "the default route"}`);
      const call = await createRetellCall({
        fromNumber: from.phoneNumber,
        toNumber: toE164(contact.lead.phone),
        agentId: campaign.aiAgentId,
        metadata: { crm_lead_id: contact.lead.id, crm_campaign_id: campaign.id, consent_source: contact.lead.aiCallConsentSource! },
        dynamicVariables: {
          customer_name: contact.lead.contactName,
          business_name: contact.lead.businessName,
          state: contact.lead.state ?? "",
          company_name: process.env.AI_DIALER_COMPANY_NAME ?? "our company",
          transfer_number: process.env.AI_DIALER_TRANSFER_NUMBER ?? "",
        },
      });
      await prisma.$transaction([
        prisma.aiCall.create({ data: {
          retellCallId: call.call_id, leadId: contact.lead.id, campaignId: campaign.id,
          outboundNumberId: from.id, fromNumber: from.phoneNumber, toNumber: toE164(contact.lead.phone),
          status: call.call_status === "ongoing" ? "IN_PROGRESS" : "REGISTERED",
          metadata: (call.metadata ?? {}) as Prisma.InputJsonValue,
          startedAt: call.start_timestamp ? new Date(call.start_timestamp) : null,
        } }),
        prisma.campaignContact.update({ where: { id: contact.id }, data: { status: "IN_PROGRESS", attempts: { increment: 1 }, lastAttempt: new Date() } }),
      ]);
      launched.push({ leadId: contact.lead.id, retellCallId: call.call_id });
    } catch (error) {
      skipped.push({ leadId: contact.lead.id, reason: error instanceof Error ? error.message : "Call failed" });
    }
  }
  return NextResponse.json({ launched: launched.length, activeBeforeLaunch: active, calls: launched, skipped });
}
