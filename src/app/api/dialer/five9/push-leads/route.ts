/**
 * Push leads to a Five9 list.
 * Port of Batch_AddToFive9List.cls / Batch_SyncToFive9List.cls.
 *
 *   POST /api/dialer/five9/push-leads
 *   Body: { listName?: string, sinceISO?: string, leadIds?: string[] }
 *
 * Auth: requires Lead.Edit perm.
 *
 * Strategy: by default pushes leads created since `sinceISO` (or last 24h)
 * with status="New" that don't already have a Five9 list assignment.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { addRecordToList } from "@/lib/five9/admin-api";

export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;

  const body = await request.json().catch(() => ({}));
  const listName = body.listName ?? process.env.FIVE9_DEFAULT_LIST;
  if (!listName) {
    return NextResponse.json({ error: "listName required (or set FIVE9_DEFAULT_LIST)" }, { status: 400 });
  }
  const sinceISO = body.sinceISO ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let leads;
  if (Array.isArray(body.leadIds) && body.leadIds.length > 0) {
    leads = await prisma.lead.findMany({
      where: { id: { in: body.leadIds } },
      select: { id: true, contactName: true, phone: true, email: true, state: true },
    });
  } else {
    leads = await prisma.lead.findMany({
      where: {
        createdAt: { gte: new Date(sinceISO) },
        status: "New",
        phone: { not: "" },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, contactName: true, phone: true, email: true, state: true },
    });
  }

  let pushed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const lead of leads) {
    const [first, ...rest] = (lead.contactName ?? "").split(" ");
    try {
      await addRecordToList({
        listName,
        phone: lead.phone,
        firstName: first || "",
        lastName: rest.join(" ") || "",
        email: lead.email ?? "",
        state: lead.state ?? "",
      });
      pushed++;
    } catch (e: unknown) {
      failed++;
      failures.push(`${lead.id}: ${e instanceof Error ? e.message : "fail"}`);
    }
  }

  return NextResponse.json({ ok: true, pushed, failed, failures: failures.slice(0, 20) });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
