import { hasPermission } from "@/lib/permissions";
import { definitionScope } from "@/lib/analytics-access";
import { analyticsPageAccess } from "@/lib/analytics-page-access";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OBJECT_METADATA } from "@/lib/reports/object-metadata";
import { ReportViewer } from "@/components/reports/report-viewer";
import type { ReportFilter, ReportSummarize } from "@/lib/reports/runner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportViewPage({ params }: PageProps) {
  const access = await analyticsPageAccess("Reports.View");
  const { id } = await params;

  const report = await prisma.report.findFirst({
    where: { id, AND: [definitionScope(access)] },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  if (!report) redirect("/reports");

  const meta = OBJECT_METADATA[report.objectType];

  return (
    <ReportViewer
      canExport={access.isAdmin || hasPermission(access.permissions, "Reports.Export")}
      canEdit={access.isAdmin || (report.createdById === access.userId && hasPermission(access.permissions, "Reports.Edit"))}
      id={report.id}
      name={report.name}
      description={report.description}
      objectType={report.objectType}
      objectLabel={meta?.pluralLabel ?? report.objectType}
      ownerName={report.createdBy?.name ?? null}
      summarize={Array.isArray(report.summarize) ? (report.summarize as unknown as ReportSummarize[]) : []}
      groupBy={report.groupBy}
      groupByLabel={report.groupBy ? (meta?.fields.find((f) => f.key === report.groupBy)?.label ?? null) : null}
      filterCount={Array.isArray(report.filters) ? (report.filters as unknown as ReportFilter[]).length : 0}
    />
  );
}
