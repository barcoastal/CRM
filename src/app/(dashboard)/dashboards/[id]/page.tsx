import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "@/components/icons/lucide";
import { DashboardClient } from "@/components/dashboards/dashboard-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DashboardDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  const dash = await prisma.dashboard.findUnique({
    where: { id },
    include: {
      tiles: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!dash) notFound();
  if (!dash.isShared && dash.createdById !== userId) notFound();

  // Plain JSON-safe shape for the client.
  const initial = {
    id: dash.id,
    name: dash.name,
    description: dash.description,
    isShared: dash.isShared,
    createdBy: dash.createdBy,
    tiles: dash.tiles.map((t) => ({
      id: t.id,
      kind: t.kind,
      title: t.title,
      queryKey: t.queryKey,
      reportId: t.reportId,
      config: t.config as Record<string, unknown>,
      position: t.position as { x: number; y: number; w: number; h: number },
    })),
  };

  return (
    <div className="space-y-5">
      <Link
        href="/dashboards"
        className="inline-flex items-center gap-1.5 text-[12px] text-[#3052ff] font-semibold"
      >
        <ArrowLeft className="size-3.5" />
        Back to Dashboards
      </Link>
      <DashboardClient initial={initial} />
    </div>
  );
}
