import type { ReportFormula } from "@/lib/reports/formulas";
import { runReport, type ReportFilter, type ReportSummarize } from "@/lib/reports/runner";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { hasPermission } from "@/lib/permissions";
import { analyticsApiAccess, definitionScope } from "@/lib/analytics-access";
import { NextRequest, NextResponse } from "next/server";
import { getQuery } from "@/lib/dashboards/queries";
import { prisma } from "@/lib/prisma";

/** Render dashboard queries and saved reports under the current viewer’s access. */
export async function POST(req: NextRequest) {
  const gate = await analyticsApiAccess("Dashboards.View");
  if ("response" in gate) return gate.response;
  const access = gate.access;
  const body = await req.json().catch(() => ({}));
  const kind = typeof body.kind === "string" ? body.kind : "";
  const queryKey = typeof body.queryKey === "string" ? body.queryKey : null;
  const reportId = typeof body.reportId === "string" ? body.reportId : null;

  try {
    if (kind === "report") {
      if (!access.isAdmin && !hasPermission(access.permissions, "Reports.View")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!reportId) {
        return NextResponse.json({ error: "reportId required" }, { status: 400 });
      }
      const report = await prisma.report.findFirst({ where: { id: reportId, AND: [definitionScope(access)] } });
      if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
      const result = await runReport({
        objectType: report.objectType,
    formulas: report.formulas as unknown as ReportFormula[],
        columns: report.columns as string[],
        filters: report.filters as unknown as ReportFilter[],
        summarize: report.summarize as unknown as ReportSummarize[],
        groupBy: report.groupBy,
        sortBy: report.sortBy,
        sortDir: report.sortDir === "desc" ? "desc" : "asc",
        rowLimit: report.rowLimit,
      });
      if ("error" in result) return ssnSafeJson(result, { status: 400 });
      return ssnSafeJson({ reportName: report.name, result });
    }

    if (!queryKey) {
      return NextResponse.json({ error: "queryKey required" }, { status: 400 });
    }
    const runner = getQuery(queryKey);
    if (!runner) {
      return NextResponse.json({ error: `Unknown queryKey: ${queryKey}` }, { status: 400 });
    }

    if (kind === "bar") {
      if (runner.kind !== "bar") {
        return NextResponse.json(
          { error: `Query ${queryKey} is not a bar query` },
          { status: 400 },
        );
      }
      const data = await runner.run();
      return NextResponse.json(data);
    }

    // kpi / count / sum / table all use scalar for v1
    if (runner.kind !== "scalar") {
      return NextResponse.json(
        { error: `Query ${queryKey} is not a scalar query` },
        { status: 400 },
      );
    }
    const data = await runner.run();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
