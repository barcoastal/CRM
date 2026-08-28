import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

/**
 * Registered SMS Magic sender numbers for the "From" picker. Prefers the
 * SmsSender table; falls back to the SMS_MAGIC_SENDER_IDS env list (comma
 * separated) or the single SMS_MAGIC_SENDER_ID.
 */
export async function GET() {
  const r = await requireAuthOrRespond("SMS.Send");
  if ("response" in r) return r.response;

  const rows = await prisma.smsSender.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { number: "asc" }],
    select: { number: true, label: true, isDefault: true },
  });
  if (rows.length > 0) {
    return NextResponse.json({ senders: rows.map((s) => ({ number: s.number, label: s.label, isDefault: s.isDefault })) });
  }

  const envList = (process.env.SMS_MAGIC_SENDER_IDS ?? process.env.SMS_MAGIC_SENDER_ID ?? "")
    .split(",").map((x) => x.trim()).filter(Boolean);
  return NextResponse.json({
    senders: envList.map((n, i) => ({ number: n, label: null, isDefault: i === 0 })),
  });
}
