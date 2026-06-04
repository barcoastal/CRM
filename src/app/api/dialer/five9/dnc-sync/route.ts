/**
 * Sync our SuppressionList to Five9 DNC.
 * Port of Five9AddNumbersToDnc.cls.
 *
 *   POST /api/dialer/five9/dnc-sync
 *
 * Pushes any SuppressionEntry created since `?since=` (default 1h) to
 * Five9's DNC table.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addToDnc } from "@/lib/five9/admin-api";

export async function POST(request: NextRequest) {
  const required = process.env.FIVE9_SYNC_SECRET;
  if (required) {
    const got =
      request.headers.get("x-five9-sync-secret") ??
      new URL(request.url).searchParams.get("secret");
    if (got !== required) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sinceMs = Number(new URL(request.url).searchParams.get("sinceMinutes") ?? "60");
  const entries = await prisma.suppressionEntry.findMany({
    where: { createdAt: { gte: new Date(Date.now() - sinceMs * 60 * 1000) } },
    select: { phone: true },
    take: 5000,
  });

  const phones = entries.map((e) => `+1${e.phone}`);
  if (phones.length === 0) return NextResponse.json({ ok: true, count: 0 });

  try {
    const result = await addToDnc(phones);
    return NextResponse.json({ ...result });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DNC sync failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
