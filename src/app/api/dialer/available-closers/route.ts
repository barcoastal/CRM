import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { availableClosers } from "@/lib/closer-tiers";

/** GET /api/dialer/available-closers - free closers grouped by tier. */
export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const tiers = await availableClosers();
  return NextResponse.json({ tiers });
}
