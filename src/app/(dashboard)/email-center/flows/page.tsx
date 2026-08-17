import { prisma } from "@/lib/prisma";
import { FlowsClient } from "./flows-client";

export const dynamic = "force-dynamic";

export default async function EmailCenterFlowsPage() {
  const flows = await prisma.flow.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      entityType: true,
      triggerEvent: true,
      inactivityDays: true,
      reentryPolicy: true,
      isActive: true,
      updatedAt: true,
      _count: { select: { runs: true } },
    },
  });
  const lastRuns = await prisma.flowRun.groupBy({
    by: ["flowId"],
    _max: { startedAt: true },
  });
  const lastByFlow = new Map(lastRuns.map((r) => [r.flowId, r._max.startedAt]));
  return (
    <FlowsClient
      flows={flows.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        entityType: f.entityType,
        triggerEvent: f.triggerEvent,
        inactivityDays: f.inactivityDays,
        reentryPolicy: f.reentryPolicy,
        isActive: f.isActive,
        runCount: f._count.runs,
        lastRunAt: lastByFlow.get(f.id)?.toISOString() ?? null,
      }))}
    />
  );
}
