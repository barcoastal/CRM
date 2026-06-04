/**
 * SAS inbound webhook — port of SF SASInboundAPI.cls.
 *
 * SAS pushes customer / balance / draft updates here. Configure the URL
 * in the SAS portal's webhook settings.
 *
 *   POST /api/payment-processors/sas/inbound
 *
 * Auth: SAS_INBOUND_SECRET env, sent as `x-sas-secret` header.
 *
 * Payload (envelope):
 *   {
 *     event: "balance.updated" | "draft.updated" | "customer.updated",
 *     data: { customer_id, balance?, drafts?: [{...}], ... }
 *   }
 *
 * Accepts a batch payload `events: [{event, data}]` as well.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface SASInboundEvent {
  event?: string;
  type?: string;
  data?: {
    customer_id?: string;
    balance?: number;
    drafts?: Array<{
      draft_id?: string;
      status?: string;
      amount?: number;
      processed_at?: string;
      settled_at?: string;
      return_code?: string;
      return_reason?: string;
    }>;
  };
}

const DRAFT_STATUS_RANK: Record<string, number> = {
  SCHEDULED: 0,
  PROCESSING: 1,
  SUCCESS: 2,
  FAILED: 5,
  CANCELLED: 5,
};

function normalizeStatus(s: string): string {
  const lower = (s ?? "").toLowerCase();
  if (lower.includes("schedul")) return "SCHEDULED";
  if (lower.includes("process")) return "PROCESSING";
  if (lower.includes("success") || lower.includes("complete")) return "SUCCESS";
  if (lower.includes("fail") || lower.includes("nsf") || lower.includes("return")) return "FAILED";
  if (lower.includes("cancel") || lower.includes("skip")) return "CANCELLED";
  return s?.toUpperCase() ?? "";
}

async function handleOne(event: SASInboundEvent): Promise<{ ok: boolean; action?: string }> {
  const kind = event.event ?? event.type ?? "";
  const data = event.data ?? {};
  if (!data.customer_id) return { ok: false };

  const account = await prisma.account.findFirst({
    where: { externalSasId: data.customer_id },
    select: { id: true },
  });
  if (!account) return { ok: false, action: "no-matching-account" };

  // Balance update
  if (typeof data.balance === "number") {
    await prisma.account.update({
      where: { id: account.id },
      data: { escrowBalance: data.balance, escrowPulledAt: new Date() },
    });
  }

  // Draft updates
  if (Array.isArray(data.drafts) && data.drafts.length > 0) {
    for (const d of data.drafts) {
      if (!d.draft_id || !d.status) continue;
      const draft = await prisma.draft.findFirst({
        where: { processorReference: d.draft_id },
        select: { id: true, status: true },
      });
      if (!draft) continue;
      const newStatus = normalizeStatus(d.status);
      if ((DRAFT_STATUS_RANK[newStatus] ?? 0) < (DRAFT_STATUS_RANK[draft.status] ?? 0)) continue;
      await prisma.draft.update({
        where: { id: draft.id },
        data: {
          status: newStatus,
          processedAt: d.processed_at ? new Date(d.processed_at) : undefined,
          settledAt: d.settled_at ? new Date(d.settled_at) : undefined,
          returnCode: d.return_code ?? undefined,
          returnReason: d.return_reason ?? undefined,
        },
      });
    }
  }

  return { ok: true, action: kind };
}

export async function POST(request: NextRequest) {
  const required = process.env.SAS_INBOUND_SECRET;
  if (required) {
    const got = request.headers.get("x-sas-secret");
    if (got !== required) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SASInboundEvent | { events: SASInboundEvent[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events: SASInboundEvent[] = "events" in body && Array.isArray(body.events) ? body.events : [body as SASInboundEvent];

  const results: Array<{ ok: boolean; action?: string }> = [];
  for (const e of events) {
    results.push(await handleOne(e));
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}
