import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { BuilderClient } from "./builder-client";
import type { FlowGraph } from "@/lib/flow/nodes";

export const dynamic = "force-dynamic";

export default async function EmailFlowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const flow = await prisma.flow.findUnique({ where: { id } });
  if (!flow) notFound();
  return (
    <BuilderClient
      initial={{
        id: flow.id,
        name: flow.name,
        entityType: flow.entityType,
        triggerEvent: flow.triggerEvent,
        inactivityDays: flow.inactivityDays,
        reentryPolicy: flow.reentryPolicy,
        reentryCooldownDays: flow.reentryCooldownDays,
        isActive: flow.isActive,
        entryCriteria: flow.entryCriteria as unknown,
        graph: flow.graph as unknown as FlowGraph,
      }}
    />
  );
}
