/**
 * Salesforce sync control endpoint.
 *   POST - start a full sync now (admin session, or x-cron-secret header)
 *   GET  - current status + log tail (admin session)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { startSfSync, getSfSyncStatus } from "@/lib/sf-sync/runner";

export const dynamic = "force-dynamic";

async function authorized(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") === secret) return true;
  const r = await requireAuthOrRespond("Account.Edit");
  return !("response" in r);
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = startSfSync("manual trigger");
  return NextResponse.json(res, { status: res.started ? 202 : 409 });
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(getSfSyncStatus());
}
