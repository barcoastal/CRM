import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { availableClosers } from "@/lib/closer-tiers";

/**
 * GET /api/dialer/available-closers - free closers grouped by tier.
 * Auth: normal CRM session, OR a ?token= matching CLOSERS_WINDOW_TOKEN (so the
 * window can run embedded inside the Five9 agent desktop, where the CRM session
 * cookie is not sent cross-site).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const envToken = process.env.CLOSERS_WINDOW_TOKEN;
  const tokenOk = !!token && !!envToken && token === envToken;

  if (!tokenOk) {
    const r = await requireAuthOrRespond();
    if ("response" in r) return r.response;
  }

  const tiers = await availableClosers();
  return NextResponse.json({ tiers });
}
