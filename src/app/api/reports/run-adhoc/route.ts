import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { runReport, type ReportConfig, type ReportFilter, type ReportSummarize } from "@/lib/reports/runner";

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.objectType !== "string") {
    return NextResponse.json({ error: "objectType required" }, { status: 400 });
  }

  const cfg: ReportConfig = {
    objectType: body.objectType,
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
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
