import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { EngagementEditor } from "@/components/engagement/sequence-editor";

export const dynamic = "force-dynamic";

export default async function EngagementSequencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;

  const seq = await prisma.engagementSequence.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { order: "asc" } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!seq) notFound();

  const [active, paused, completed, exited, templates, lists, users] = await Promise.all([
    prisma.engagementEnrollment.count({ where: { sequenceId: id, status: "ACTIVE" } }),
    prisma.engagementEnrollment.count({ where: { sequenceId: id, status: "PAUSED" } }),
    prisma.engagementEnrollment.count({ where: { sequenceId: id, status: "COMPLETED" } }),
    prisma.engagementEnrollment.count({ where: { sequenceId: id, status: "EXITED" } }),
    prisma.emailTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, subject: true },
    }),
    prisma.leadList.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {seq.name}
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> /{" "}
            <Link href="/marketing/engagement" className="text-[#3052ff]">Engagement</Link> /{" "}
            {seq.name}
          </p>
        </div>
      </div>

      <EngagementEditor
        seq={{
          id: seq.id,
          name: seq.name,
          description: seq.description,
          entityType: seq.entityType,
          isActive: seq.isActive,
          allowReEnroll: seq.allowReEnroll,
          maxEnrollsPerTick: seq.maxEnrollsPerTick,
          entryCriteria: seq.entryCriteria as { kind: "and" | "or"; conditions: Array<{ field: string; operator: string; value?: unknown }> },
          totalEnrolled: seq.totalEnrolled,
          totalCompleted: seq.totalCompleted,
          totalExited: seq.totalExited,
          steps: seq.steps.map((s) => ({
            id: s.id,
            order: s.order,
            kind: s.kind,
            label: s.label,
            config: s.config as Record<string, unknown>,
          })),
        }}
        stats={{ active, paused, completed, exited }}
        templates={templates}
        lists={lists}
        users={users}
      />
    </div>
  );
}
