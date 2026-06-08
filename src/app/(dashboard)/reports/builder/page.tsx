import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OBJECT_METADATA } from "@/lib/reports/object-metadata";
import { ReportBuilder } from "@/components/reports/report-builder";
import type {
  ReportFilter,
  ReportSummarize,
} from "@/lib/reports/runner";

interface PageProps {
  searchParams: Promise<{ objectType?: string; id?: string }>;
}

export default async function ReportBuilderPage({ searchParams }: PageProps) {
  await auth();

  const { objectType, id } = await searchParams;

  // If editing a saved report, load it and use its objectType.
  if (id) {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) redirect("/reports");
    const meta = OBJECT_METADATA[report.objectType];
    if (!meta) redirect("/reports");
    return (
      <ReportBuilder
        objectType={report.objectType}
        metadata={meta}
        initial={{
          id: report.id,
          name: report.name,
          description: report.description,
          columns: Array.isArray(report.columns) ? (report.columns as unknown as string[]) : [],
          filters: Array.isArray(report.filters) ? (report.filters as unknown as ReportFilter[]) : [],
          groupBy: report.groupBy,
          sortBy: report.sortBy,
          sortDir: (report.sortDir as "asc" | "desc") ?? "asc",
          summarize: Array.isArray(report.summarize) ? (report.summarize as unknown as ReportSummarize[]) : [],
          rowLimit: report.rowLimit,
        }}
      />
    );
  }

  if (!objectType || !OBJECT_METADATA[objectType]) {
    redirect("/reports/new");
  }

  const meta = OBJECT_METADATA[objectType];
  return (
    <ReportBuilder
      objectType={objectType}
      metadata={meta}
      initial={{
        id: null,
        name: `New ${meta.label} Report`,
        description: null,
        columns: meta.defaultColumns,
        filters: [],
        groupBy: null,
        sortBy: null,
        sortDir: "asc",
        summarize: [],
        rowLimit: 2000,
      }}
    />
  );
}
