"use client";

/**
 * Recent FlowRuns for a single flow. Renders status badges and an expandable
 * step-by-step trace per run.
 */

import { useCallback, useEffect, useState } from "react";

interface RunRow {
  id: string;
  status: string;
  entityType: string;
  entityId: string;
  currentNodeId: string | null;
  scheduledResumeAt: string | null;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  trace: unknown;
}

function statusPill(status: string) {
  const tone: Record<string, { bg: string; fg: string }> = {
    RUNNING: { bg: "#fff5cf", fg: "#7a5c00" },
    COMPLETED: { bg: "#e0f5e9", fg: "#0d6b3b" },
    FAILED: { bg: "#fde2e2", fg: "#9d1414" },
    WAITING: { bg: "#e3f0ff", fg: "#0b5cad" },
    CANCELLED: { bg: "#ecebea", fg: "#444656" },
  };
  const t = tone[status] ?? tone.RUNNING;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: t.bg, color: t.fg }}
    >
      {status}
    </span>
  );
}

function formatRelative(dt: string): string {
  const d = new Date(dt);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FlowRunsList({ flowId }: { flowId: string }) {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/flows/${flowId}/runs?limit=20`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      setRuns(data.runs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [flowId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return <div className="text-[11px] text-[#9d1414]">{error}</div>;
  }
  if (runs === null) {
    return <div className="text-[11px] text-[#706e6b]">Loading runs...</div>;
  }
  if (runs.length === 0) {
    return (
      <div className="text-[11px] text-[#706e6b]">
        No runs yet. The flow will produce a run when a matching record fires its trigger event.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={load}
        className="text-[11px] font-semibold text-[#3052ff]"
      >
        Refresh
      </button>
      {runs.map((r) => {
        const trace = Array.isArray(r.trace) ? (r.trace as Array<{ nodeId: string; kind: string; at: string; status: string; output?: unknown; error?: string }>) : [];
        const isOpen = expanded === r.id;
        return (
          <div key={r.id} className="border border-[#f2f3ff] rounded">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : r.id)}
              className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-[#faf8ff] text-left"
            >
              <div className="flex items-center gap-1.5">
                {statusPill(r.status)}
                <span className="text-[11px] text-[#444656]">{r.entityType} {r.entityId.slice(0, 8)}</span>
              </div>
              <div className="text-[10px] text-[#706e6b]">{formatRelative(r.startedAt)}</div>
            </button>
            {isOpen ? (
              <div className="px-2 py-1.5 border-t border-[#f2f3ff] bg-[#fafaff] space-y-1.5">
                {r.errorMessage ? (
                  <div className="text-[10px] text-[#9d1414] font-semibold">Error: {r.errorMessage}</div>
                ) : null}
                {trace.length === 0 ? (
                  <div className="text-[10px] text-[#706e6b]">No steps recorded.</div>
                ) : (
                  trace.map((step, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px]">
                      <span
                        className="mt-0.5 inline-block w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          background:
                            step.status === "ok"
                              ? "#0d6b3b"
                              : step.status === "error"
                              ? "#9d1414"
                              : step.status === "waited"
                              ? "#0b5cad"
                              : "#706e6b",
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-[#131b2e]">
                          {step.kind} ({step.nodeId})
                        </div>
                        {step.output ? (
                          <pre className="text-[10px] text-[#444656] whitespace-pre-wrap">
                            {JSON.stringify(step.output, null, 2)}
                          </pre>
                        ) : null}
                        {step.error ? <div className="text-[#9d1414]">{step.error}</div> : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
