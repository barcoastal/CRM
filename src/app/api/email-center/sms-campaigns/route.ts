import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { countSmsAudience } from "@/lib/sms/audience";

/** GET - list SMS campaigns (newest first). POST - create a draft campaign. */
export async function GET() {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const items = await prisma.smsCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Email.Send");
  if ("response" in r) return r.response;
  const b = (await req.json().catch(() => ({}))) as { name?: string; body?: string; templateId?: string; entity?: string; segmentId?: string };
  if (!b.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!b.body?.trim()) return NextResponse.json({ error: "message body required" }, { status: 400 });
  const entity = b.entity === "Contact" ? "Contact" : "Lead";
  const total = await countSmsAudience({ entity, segmentId: b.segmentId || null }).catch(() => 0);
  const created = await prisma.smsCampaign.create({
    data: {
      name: b.name.trim(), body: b.body, templateId: b.templateId || null,
      entity, segmentId: b.segmentId || null, total, createdById: r.session.userId,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
