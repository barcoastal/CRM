import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * All messages in one conversation, matched by the other party's number
 * (last 10 digits), oldest-first for a chat thread. Also flips any unread
 * inbound messages to a read-ish state is not needed here; the console marks
 * read separately if desired.
 */
export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond("SMS.Send");
  if ("response" in r) return r.response;
  const number = new URL(req.url).searchParams.get("number") ?? "";
  const key = number.replace(/[^0-9]/g, "").slice(-10);
  if (key.length < 7) return NextResponse.json({ messages: [] });

  const rows = await prisma.smsMessage.findMany({
    where: { OR: [{ toNumber: { contains: key } }, { fromNumber: { contains: key } }] },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: { id: true, direction: true, status: true, body: true, createdAt: true, errorReason: true },
  });
  return NextResponse.json({ messages: rows });
}
