import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sendSmsCampaign } from "@/lib/sms/campaign-sender";

/** GET - one campaign + its message stats. POST - send it now. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await params;
  const campaign = await prisma.smsCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const grouped = await prisma.smsMessage.groupBy({ by: ["status"], where: { smsCampaignId: id }, _count: { _all: true } });
  const stats: Record<string, number> = {};
  for (const g of grouped) stats[g.status] = g._count._all;
  return NextResponse.json({ campaign, stats });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const { id } = await params;
  const result = await sendSmsCampaign(id);
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 400 });
  return NextResponse.json(result);
}
