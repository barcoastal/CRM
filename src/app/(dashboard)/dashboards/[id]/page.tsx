import { hasPermission } from "@/lib/permissions";
import { definitionScope } from "@/lib/analytics-access";
import { analyticsPageAccess } from "@/lib/analytics-page-access";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "@/components/icons/lucide";
import { DashboardClient } from "@/components/dashboards/dashboard-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DashboardDetailPage({ params }: PageProps) {
  const { id } = await params;
  const access = await analyticsPageAccess("Dashboards.View");

  const dash = await prisma.dashboard.findFirst({
    where: { id, AND: [definitionScope(access)] },
    include: {
      tiles: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!dash) notFound();

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
      <DashboardClient initial={initial} canEdit={access.isAdmin || (dash.createdById === access.userId && hasPermission(access.permissions, "Dashboards.Create"))} />
    </div>
  );
}
