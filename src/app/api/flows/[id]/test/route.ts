/**
 * Flow dry-run API. Executes the flow's graph against a sample record without
 * persisting any FlowRun, side effects (email/SMS/Task creation), or DB
 * mutations. Returns the trace + result so admins can validate authoring.
 *
 *   POST /api/flows/:id/test  { sampleRecord: { ... } }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { runFlowDryRun } from "@/lib/flow/executor";
import type { ConditionGroup, FlowGraph } from "@/lib/flow/nodes";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await params;
  const flow = await prisma.flow.findUnique({ where: { id } });
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const sampleRecord = (body?.sampleRecord ?? {}) as Record<string, unknown>;

  const graph = (flow.graph as unknown as FlowGraph) ?? { nodes: [], edges: [] };
  const criteria = (flow.entryCriteria as unknown as ConditionGroup | null) ?? null;
  const result = await runFlowDryRun(graph, criteria, flow.entityType, sampleRecord);
  return NextResponse.json(result);
}
