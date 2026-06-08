import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { getQuery } from "@/lib/dashboards/queries";
import { prisma } from "@/lib/prisma";

/**
 * Render-time data endpoint. Given { kind, queryKey?, reportId?, config? }
 * returns one of:
 *   KPI / count / sum: { value, format }
 *   Bar:               { buckets: [...] }
 *   Report-backed:     { error } if Reports infra isn't ready yet — never
 *                      crashes.
 */
export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const kind = typeof body.kind === "string" ? body.kind : "";
  const queryKey = typeof body.queryKey === "string" ? body.queryKey : null;
  const reportId = typeof body.reportId === "string" ? body.reportId : null;

  try {
    if (kind === "report") {
      if (!reportId) {
        return NextResponse.json({ error: "reportId required" }, { status: 400 });
      }
      // Try to look up the report. If the model isn't ready or the runner
      // isn't available, return a soft error so the tile shows "not ready"
      // instead of crashing the page.
      try {
        // The Reports agent may not have finished. Guard with a soft try.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reportClient = (prisma as any).report;
        if (!reportClient || typeof reportClient.findUnique !== "function") {
          return NextResponse.json({
            error: "report-backed tiles not yet available",
          });
        }
        const report = await reportClient.findUnique({ where: { id: reportId } });
        if (!report) {
          return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }
        // No runner shipped yet — surface a friendly stub.
        return NextResponse.json({
          error: "report-backed tiles not yet available",
          reportName: report.name,
        });
      } catch {
        return NextResponse.json({
          error: "report-backed tiles not yet available",
        });
      }
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
