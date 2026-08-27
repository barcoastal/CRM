import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * Conversation list for the two-way SMS console: recent messages grouped by the
 * other party's number (last 10 digits), newest first, with the linked
 * lead/account for a display name.
 */
const last10 = (raw: string) => { const d = (raw ?? "").replace(/[^0-9]/g, ""); return d.length > 10 ? d.slice(-10) : d; };

export async function GET(_req: NextRequest) {
  const r = await requireAuthOrRespond("SMS.Send");
  if ("response" in r) return r.response;

  const rows = await prisma.smsMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 800,
    include: {
      lead: { select: { id: true, contactName: true, businessName: true } },
      account: { select: { id: true, name: true } },
    },
  });

  const convos = new Map<string, {
    key: string; number: string; name: string | null;
    leadId: string | null; accountId: string | null;
    lastBody: string; lastAt: Date; lastDir: string; unread: number;
  }>();

  for (const m of rows) {
    const other = m.direction === "INBOUND" ? m.fromNumber : m.toNumber;
    const key = last10(other) || other;
    if (!key) continue;
    const existing = convos.get(key);
    const name = m.lead?.contactName ?? m.lead?.businessName ?? m.account?.name ?? null;
    if (!existing) {
      convos.set(key, {
        key, number: other, name,
        leadId: m.lead?.id ?? m.leadId ?? null, accountId: m.account?.id ?? m.accountId ?? null,
        lastBody: m.body, lastAt: m.createdAt, lastDir: m.direction,
        unread: m.direction === "INBOUND" && m.status === "RECEIVED" ? 1 : 0,
      });
    } else {
      if (!existing.name && name) existing.name = name;
      if (!existing.leadId && (m.lead?.id ?? m.leadId)) existing.leadId = m.lead?.id ?? m.leadId ?? null;
      if (!existing.accountId && (m.account?.id ?? m.accountId)) existing.accountId = m.account?.id ?? m.accountId ?? null;
      if (m.direction === "INBOUND" && m.status === "RECEIVED") existing.unread += 1;
    }
  }

  return NextResponse.json({ conversations: [...convos.values()] });
}
