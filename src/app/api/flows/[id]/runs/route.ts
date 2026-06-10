/**
 * Flow runs API.
 *   GET /api/flows/:id/runs[?limit=20]
 *
 * Returns the most recent FlowRuns for a flow including their JSON trace so the
 * UI can render the step-by-step execution log.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
  const runs = await prisma.flowRun.findMany({
    where: { flowId: id },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ runs });
}
