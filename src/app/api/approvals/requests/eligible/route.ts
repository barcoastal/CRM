import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { findEligibleProcesses } from "@/lib/approvals/engine";

export async function GET(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") ?? "";
  const entityId = url.searchParams.get("entityId") ?? "";
  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
  }

  // Already pending? Surface that to suppress the submit button.
  const pending = await prisma.approvalRequest.findFirst({
    where: { entityType, entityId, status: "PENDING" },
    select: { id: true, processId: true, currentStepId: true, submittedById: true, submittedAt: true },
  });

  const processes = await findEligibleProcesses(entityType, entityId);

  const items = processes.map((p) => {
    const submitters = Array.isArray(p.initialSubmitters)
      ? (p.initialSubmitters as unknown[]).map(String)
      : [];
    const canSubmit = submitters.length === 0 || submitters.includes(r.session.userId);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      entityType: p.entityType,
      stepCount: p.steps.length,
      canSubmit,
    };
  });

  return NextResponse.json({ items, pending });
}
