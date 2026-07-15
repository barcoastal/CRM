import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OBJECT_METADATA } from "@/lib/reports/object-metadata";
import { ReportViewer } from "@/components/reports/report-viewer";
import type { ReportFilter, ReportSummarize } from "@/lib/reports/runner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportViewPage({ params }: PageProps) {
  await auth();
  const { id } = await params;

  const report = await prisma.report.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  if (!report) redirect("/reports");

  const meta = OBJECT_METADATA[report.objectType];

  return (
    <ReportViewer
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
