"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Pencil, ChevronDown } from "@/components/icons/lucide";
import type { ReportResult, ReportSummarize } from "@/lib/reports/runner";
import { ResultsTable } from "@/components/reports/report-builder";

interface Props {
  id: string;
  name: string;
  description: string | null;
  objectType: string;
  objectLabel: string;
  ownerName: string | null;
  summarize: ReportSummarize[];
  groupBy: string | null;
  filterCount: number;
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
}

export function ReportViewer({
  id,
  name,
  description,
  objectType,
  objectLabel,
  ownerName,
  summarize,
  groupBy,
  filterCount,
}: Props) {
  const [running, setRunning] = useState(true);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  async function runReport() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to run report");
        setResult(null);
      } else {
        setResult(data as ReportResult);
        if (data?.groups) {
          setExpandedGroups(new Set(data.groups.map((g: { key: string }) => g.key)));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run report");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    runReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-[12px] text-[#3052ff] font-semibold mb-2"
          >
            <ArrowLeft className="size-3" />
            All Reports
          </Link>
          <h1
            className="text-[22px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {name}
          </h1>
          <div className="text-[12px] text-[#444656] mt-1">
            {objectLabel}
            {ownerName ? ` . Owner ${ownerName}` : ""}
            {filterCount > 0 ? ` . ${filterCount} filter${filterCount === 1 ? "" : "s"}` : ""}
            {groupBy ? ` . Grouped by ${groupBy}` : ""}
          </div>
          {description && (
            <p className="text-[13px] text-[#444656] mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runReport}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Play className="size-3" />
            {running ? "Running..." : "Run"}
          </button>
          <Link
            href={`/reports/builder?objectType=${objectType}&id=${id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold text-[#131b2e] bg-white border border-[#e4e6f5]"
          >
            <Pencil className="size-3" />
            Edit
          </Link>
        </div>
      </div>

      <section
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div className="px-4 py-3 border-b border-[#f2f3ff] flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-[#131b2e]">Results</div>
            {result && (
              <div className="text-[11px] text-[#706e6b]">
                {result.rowCount} row{result.rowCount === 1 ? "" : "s"}
                {result.groups ? ` in ${result.groups.length} group${result.groups.length === 1 ? "" : "s"}` : ""}
              </div>
            )}
          </div>
          {result?.totals && summarize.length > 0 && (
            <div className="flex items-center gap-3 text-[12px] text-[#131b2e]">
              {summarize.map((s) => {
                const key = `${s.field}_${s.kind}`;
                const val = (result.totals as Record<string, unknown>)[key];
                return (
                  <div key={key}>
                    <span className="text-[#706e6b]">
                      {s.field} {s.kind}:
                    </span>{" "}
                    <span className="font-bold">{formatCell(val)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="px-4 py-3 text-[12px] text-[#942b00] bg-[#fff2ef]">
            Error: {error}
          </div>
        )}

        {running && !result && (
          <div className="px-4 py-10 text-center text-[12px] text-[#706e6b]">Running report...</div>
        )}

        {result && (
          <div className="overflow-x-auto">
            {result.groups ? (
              <div>
                {result.groups.map((g) => {
                  const expanded = expandedGroups.has(g.key);
                  return (
                    <div key={g.key} className="border-b border-[#f2f3ff] last:border-b-0">
                      <button
                        onClick={() =>
                          setExpandedGroups((cur) => {
                            const next = new Set(cur);
                            if (next.has(g.key)) next.delete(g.key);
                            else next.add(g.key);
                            return next;
                          })
                        }
                        className="w-full flex items-center justify-between px-4 py-2 bg-[#fafaff] hover:bg-[#f2f3ff] text-left"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={`size-3 transition-transform ${expanded ? "" : "-rotate-90"}`}
                          />
                          <span className="text-[12px] font-bold text-[#131b2e]">{g.key}</span>
                          <span className="text-[11px] text-[#706e6b]">
                            ({(g.summary as Record<string, unknown>)._count as number} rows)
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[#131b2e]">
                          {summarize.map((s) => {
                            const key = `${s.field}_${s.kind}`;
                            const val = (g.summary as Record<string, unknown>)[key];
                            return (
                              <div key={key}>
                                <span className="text-[#706e6b]">
                                  {s.field} {s.kind}:
                                </span>{" "}
                                <span className="font-bold">{formatCell(val)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </button>
                      {expanded && (
                        <ResultsTable
                          columns={result.columns}
                          rows={g.rows}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <ResultsTable columns={result.columns} rows={result.rows} />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
