/**
 * TEMPORARY reverse-engineering probe for the Five9 Supervisor REST API
 * (used to crack the recording-retrieval flow for transcription). Auth-gated.
 * Remove once the transcription pipeline is built.
 *
 * GET  /api/dialer/five9/sup-probe                 → session info (userId/orgId)
 * POST /api/dialer/five9/sup-probe { path, method, body } → raw passthrough
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supervisorFeed } from "@/lib/five9/supervisor-feed";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(supervisorFeed.sessionInfo);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { path?: string; method?: string; body?: unknown };
  if (!body.path || typeof body.path !== "string" || !body.path.startsWith("/")) {
    return NextResponse.json({ error: "path required (starts with /)" }, { status: 400 });
  }
  const result = await supervisorFeed.rawRequest(body.path, body.method ?? "GET", body.body);
  return NextResponse.json(result);
}
