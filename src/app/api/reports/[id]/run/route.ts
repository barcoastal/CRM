import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { runReport, type ReportConfig, type ReportFilter, type ReportSummarize } from "@/lib/reports/runner";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Body can carry filterOverrides for future use; accept and ignore for now.
  await _req.json().catch(() => ({}));

  const cfg: ReportConfig = {
    objectType: report.objectType,
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
  prisma.report.update({ where: { id }, data: { lastRunAt: new Date() } }).catch(() => {});

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
