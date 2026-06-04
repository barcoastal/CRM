import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { makeCtx, triggerUpdate } from "@/lib/triggers/runner";
import type { Envelope } from "@/generated/prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Read");
  if ("response" in r) return r.response;
  const { id } = await params;
  const envelope = await prisma.envelope.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "desc" } } },
  });
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(envelope);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.documentUrl === "string" || body.documentUrl === null) data.documentUrl = body.documentUrl;
  if (typeof body.documentName === "string") data.documentName = body.documentName;
  if (typeof body.voidReason === "string") data.voidReason = body.voidReason;

  const ctx = makeCtx(session.userId);
  const envelope = await triggerUpdate<Envelope>("envelope", id, data, ctx);
  return NextResponse.json(envelope);
}
