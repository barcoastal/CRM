import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { makeCtx, triggerCreate } from "@/lib/triggers/runner";
import type { Envelope } from "@/generated/prisma/client";

const RECORD_TYPES = ["CONTRACT", "BANK_CHANGE", "DISCLOSURE", "AMENDMENT", "OTHER"];

export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const body = await request.json().catch(() => ({}));

  const {
    recordType,
    opportunityId,
    accountId,
    leadId,
    signerName,
    signerEmail,
    signerPhone,
    templateName,
    documentName,
    documentUrl,
    expiresAt,
  } = body ?? {};

  if (!recordType || !RECORD_TYPES.includes(recordType)) {
    return NextResponse.json({ error: "Invalid recordType" }, { status: 400 });
  }
  if (!signerName || !signerEmail || !documentName) {
    return NextResponse.json({ error: "signerName, signerEmail, documentName required" }, { status: 400 });
  }
  if (!opportunityId && !accountId && !leadId) {
    return NextResponse.json({ error: "Must attach to opportunityId, accountId, or leadId" }, { status: 400 });
  }

  const ctx = makeCtx(session.userId);
  const envelope = await triggerCreate<Envelope>("envelope", {
    recordType,
    opportunityId: opportunityId ?? null,
    accountId: accountId ?? null,
    leadId: leadId ?? null,
    signerName,
    signerEmail,
    signerPhone: signerPhone ?? null,
    templateName: templateName ?? null,
    documentName,
    documentUrl: documentUrl ?? null,
    status: "DRAFT",
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    createdById: session.userId,
  }, ctx);

  return NextResponse.json(envelope);
}

export async function GET(request: NextRequest) {
  const r = await requireAuthOrRespond("Opportunity.Read");
  if ("response" in r) return r.response;
  const { searchParams } = new URL(request.url);
  const opportunityId = searchParams.get("opportunityId");
  const accountId = searchParams.get("accountId");
  const leadId = searchParams.get("leadId");

  const where: Record<string, string> = {};
  if (opportunityId) where.opportunityId = opportunityId;
  if (accountId) where.accountId = accountId;
  if (leadId) where.leadId = leadId;

  const envelopes = await prisma.envelope.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { events: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  return NextResponse.json(envelopes);
}
