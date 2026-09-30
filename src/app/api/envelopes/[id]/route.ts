import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { makeCtx, triggerUpdate } from "@/lib/triggers/runner";
import type { Envelope } from "@/generated/prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond("Opportunity.View");
  if ("response" in r) return r.response;
  const { id } = await params;
  const envelope = await prisma.envelope.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "desc" } } },
  });
  if (!envelope)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(envelope);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Status is controlled by the verified signing/void/decline workflows only.
  if (body.status !== undefined)
    return NextResponse.json(
      { error: "Use the envelope workflow to change status." },
      { status: 400 },
    );
  const current = await prisma.envelope.findUnique({ where: { id } });
  if (!current || current.status !== "DRAFT")
    return NextResponse.json(
      { error: "Only drafts can be edited." },
      { status: 409 },
    );
  const data: Record<string, unknown> = {};
  if (typeof body.documentUrl === "string" || body.documentUrl === null)
    data.documentUrl = body.documentUrl;
  if (typeof body.documentName === "string")
    data.documentName = body.documentName;
  if (typeof body.voidReason === "string") data.voidReason = body.voidReason;

  const ctx = makeCtx(session.userId);
  const envelope = await triggerUpdate<Envelope>("envelope", id, data, ctx);
  return NextResponse.json(envelope);
}
