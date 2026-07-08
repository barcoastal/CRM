import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProcessEditorClient } from "@/components/approvals/process-editor-client";

export default async function ApprovalProcessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await auth();
  const { id } = await params;

  const process = await prisma.approvalProcess.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      steps: { orderBy: { order: "asc" } },
    },
  });
  if (!process) notFound();

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.4px] font-semibold text-[#747474]">
            Approval Process
          </div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {process.name}
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Applies to {process.entityType}. {process.description ?? ""}
          </p>
        </div>
        <Link
          href="/approvals/processes"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
        >
          Back to Processes
        </Link>
      </div>

      <ProcessEditorClient
        process={{
          id: process.id,
          name: process.name,
          description: process.description,
          entityType: process.entityType,
          isActive: process.isActive,
          entryCriteria: process.entryCriteria as unknown as { field: string; operator: string; value: string }[],
          initialSubmitters: process.initialSubmitters as unknown as string[],
        }}
        steps={process.steps.map((s) => ({
          id: s.id,
          order: s.order,
          name: s.name,
          approverUserIds: s.approverUserIds,
          useSubmitterManager: s.useSubmitterManager,
          allowSkip: s.allowSkip,
        }))}
        users={users}
      />
    </div>
  );
}
