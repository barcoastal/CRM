import type { ReportFormula } from "@/lib/reports/formulas";
import { analyticsApiAccess } from "@/lib/analytics-access";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { runReport, type ReportConfig, type ReportFilter, type ReportSummarize } from "@/lib/reports/runner";

export async function POST(req: NextRequest) {
  const gate = await analyticsApiAccess("Reports.View");
  if ("response" in gate) return gate.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.objectType !== "string") {
    return ssnSafeJson({ error: "objectType required" }, { status: 400 });
  }

  const cfg: ReportConfig = {
    objectType: body.objectType,
    formulas: body.formulas as ReportFormula[] | undefined,
    columns: Array.isArray(body.columns) ? (body.columns as string[]) : [],
    filters: Array.isArray(body.filters) ? (body.filters as ReportFilter[]) : [],
    groupBy: typeof body.groupBy === "string" ? body.groupBy : null,
    sortBy: typeof body.sortBy === "string" ? body.sortBy : null,
    sortDir: body.sortDir === "desc" ? "desc" : "asc",
    summarize: Array.isArray(body.summarize) ? (body.summarize as ReportSummarize[]) : [],
    rowLimit: typeof body.rowLimit === "number" ? body.rowLimit : 2000,
  };

  const result = await runReport(cfg);
  if ("error" in result) {
    return ssnSafeJson({ error: result.error }, { status: 400 });
  }
  return ssnSafeJson(result);
}
