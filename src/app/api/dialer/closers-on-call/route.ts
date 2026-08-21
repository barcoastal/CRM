import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { closersOnCall } from "@/lib/closer-tiers";

/** GET /api/dialer/closers-on-call - closers currently on a call + client debt. */
export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const rows = await closersOnCall();
  return NextResponse.json({ rows, at: Date.now() });
}
