import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { makeCtx, triggerUpdate } from "@/lib/triggers/runner";
import type { Envelope } from "@/generated/prisma/client";

/** POST /api/envelopes/[id]/send — flip from DRAFT to SENT, returns signing URL. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const env = await prisma.envelope.findUnique({ where: { id } });
  if (!env) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (env.status !== "DRAFT") {
    return NextResponse.json({ error: `Cannot send an envelope in ${env.status} state` }, { status: 400 });
  }

  const ctx = makeCtx(session.userId);
  const updated = await triggerUpdate<Envelope>("envelope", id, { status: "SENT" }, ctx);

  // Signing URL is /sign/<token>
  const base = new URL(_request.url).origin;
  const signingUrl = `${base}/sign/${updated.signingToken}`;

  return NextResponse.json({
    ok: true,
    envelope: updated,
    signingUrl,
  });
}
