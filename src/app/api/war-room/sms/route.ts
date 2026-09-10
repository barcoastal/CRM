import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * War Room SMS feed: one conversation per outside number, but ONLY numbers that
 * have replied to us (at least one inbound). i.e. "we texted them (flow/campaign)
 * and got a reply". Each is its own reply thread, opened via /api/sms/thread.
 */
const last10 = (raw: string) => { const d = (raw ?? "").replace(/[^0-9]/g, ""); return d.length > 10 ? d.slice(-10) : d; };

export async function GET(_req: NextRequest) {
  const r = await requireAuthOrRespond("SMS.Send");
  if ("response" in r) return r.response;

  const rows = await prisma.smsMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 1500,
    include: {
      lead: { select: { id: true, contactName: true, businessName: true } },
      account: { select: { id: true, name: true } },
    },
  });

  const convos = new Map<string, {
    key: string; number: string; name: string | null;
    lastBody: string; lastAt: string; lastDir: string; unread: number;
    hasInbound: boolean; hasOutbound: boolean;
    leadId: string | null; accountId: string | null;
  }>();

  for (const m of rows) {
    const other = m.direction === "INBOUND" ? m.fromNumber : m.toNumber;
    const key = last10(other) || other;
    if (!key) continue;
    const name = m.lead?.contactName ?? m.lead?.businessName ?? m.account?.name ?? null;
    const existing = convos.get(key);
    if (!existing) {
      convos.set(key, {
        key, number: other, name,
        lastBody: m.body, lastAt: m.createdAt.toISOString(), lastDir: m.direction,
        unread: m.direction === "INBOUND" && m.status === "RECEIVED" ? 1 : 0,
        hasInbound: m.direction === "INBOUND",
        hasOutbound: m.direction === "OUTBOUND",
        leadId: m.lead?.id ?? m.leadId ?? null, accountId: m.account?.id ?? m.accountId ?? null,
      });
    } else {
      if (!existing.name && name) existing.name = name;
      if (m.direction === "INBOUND") existing.hasInbound = true;
      if (m.direction === "OUTBOUND") existing.hasOutbound = true;
      if (m.direction === "INBOUND" && m.status === "RECEIVED") existing.unread += 1;
      if (!existing.leadId && (m.lead?.id ?? m.leadId)) existing.leadId = m.lead?.id ?? m.leadId ?? null;
      if (!existing.accountId && (m.account?.id ?? m.accountId)) existing.accountId = m.account?.id ?? m.accountId ?? null;
    }
  }

  // Only numbers that replied to us.
  const conversations = [...convos.values()]
    .filter((c) => c.hasInbound)
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  return NextResponse.json({ conversations });
}
