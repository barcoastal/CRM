import type { ReportOptions } from "@/lib/reports/advanced";
import type { ReportFormula } from "@/lib/reports/formulas";
import { analyticsApiAccess, definitionScope } from "@/lib/analytics-access";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { runReport, type ReportConfig, type ReportFilter, type ReportSummarize } from "@/lib/reports/runner";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await analyticsApiAccess("Reports.View");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const { id } = await ctx.params;

  const report = await prisma.report.findFirst({ where: { id, AND: [definitionScope(access)] } });
  if (!report) return ssnSafeJson({ error: "Not found" }, { status: 404 });

  // Body can carry filterOverrides for future use; accept and ignore for now.
  await _req.json().catch(() => ({}));

  const cfg: ReportConfig = {
    objectType: report.objectType,
    options: report.options as unknown as ReportOptions,
    formulas: report.formulas as unknown as ReportFormula[],
    columns: Array.isArray(report.columns) ? (report.columns as unknown as string[]) : [],
    filters: Array.isArray(report.filters) ? (report.filters as unknown as ReportFilter[]) : [],
    groupBy: report.groupBy,
    sortBy: report.sortBy,
    sortDir: (report.sortDir as "asc" | "desc") ?? "asc",
    summarize: Array.isArray(report.summarize) ? (report.summarize as unknown as ReportSummarize[]) : [],
    rowLimit: report.rowLimit,
  };

  const result = await runReport(cfg);

  // Mark last run; fire-and-forget so we don't slow the response.
  prisma.report.update({ where: { id, AND: [definitionScope(access)] }, data: { lastRunAt: new Date() } }).catch(() => {});

  if ("error" in result) {
    return ssnSafeJson({ error: result.error }, { status: 400 });
  }
  return ssnSafeJson(result);
}
