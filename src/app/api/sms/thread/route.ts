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

  // Match on digits-only (last 10) so a formatted stored number like
  // "+1 (904) 881-0033" still matches the digit key "9048810033".
  const rows = await prisma.$queryRaw<Array<{ id: string; direction: string; status: string; body: string; createdAt: Date; errorReason: string | null }>>`
    SELECT id, direction, status, body, "createdAt", "errorReason"
    FROM "SmsMessage"
    WHERE right(regexp_replace("toNumber", '[^0-9]', '', 'g'), 10) = ${key}
       OR right(regexp_replace("fromNumber", '[^0-9]', '', 'g'), 10) = ${key}
    ORDER BY "createdAt" ASC
    LIMIT 300`;
  return NextResponse.json({ messages: rows });
}
