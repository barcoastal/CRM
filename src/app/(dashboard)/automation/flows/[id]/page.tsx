import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FlowEditor } from "@/components/flow/flow-editor";
import { ArrowLeft } from "@/components/icons/lucide";

export const dynamic = "force-dynamic";

export default async function FlowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flow = await prisma.flow.findUnique({ where: { id } });
  if (!flow) notFound();

  // Snapshot for the client editor.
  const initial = {
    id: flow.id,
    name: flow.name,
    description: flow.description ?? "",
    entityType: flow.entityType,
    triggerEvent: flow.triggerEvent,
    isActive: flow.isActive,
    entryCriteria: flow.entryCriteria,
    triggerOnFieldChanges: flow.triggerOnFieldChanges,
    graph: flow.graph,
  };

  return (
    <div className="space-y-3">
      <Link
        href="/automation/flows"
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#3052ff]"
      >
        <ArrowLeft className="size-3" /> Back to Flows
      </Link>
      <FlowEditor initial={initial} />
    </div>
  );
}
