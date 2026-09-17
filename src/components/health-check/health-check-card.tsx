"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
export interface HealthCheckResult { id: string; label: string; ok: boolean; }

function StatusIcon({ ok, size = 16 }: { ok: boolean; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 520 520" fill={ok ? "#2e844a" : "#ea001e"} aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d={ok
      ? "M260 20a240 240 0 1 0 0 480 240 240 0 1 0 0-480m134 180L241 355c-6 6-16 6-22 0l-84-85c-6-6-6-16 0-22l22-22c6-6 16-6 22 0l44 45a10 10 0 0 0 15 0l112-116c6-6 16-6 22 0l22 22c7 6 7 16 0 23"
      : "M260 20C128 20 20 128 20 260s108 240 240 240 240-108 240-240S392 20 260 20M80 260a180 180 0 0 1 284-147L113 364a176 176 0 0 1-33-104m180 180c-39 0-75-12-104-33l251-251a180 180 0 0 1-147 284"} />
  </svg>;
}

export function HealthCheckCard({ results }: { results: HealthCheckResult[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [refreshing, startTransition] = useTransition();
  const contentId = useId();
  const allOk = results.every(item => item.ok);
  return (
    <article aria-label="Health Check Results" aria-busy={refreshing} style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, marginBottom: 8, overflow: "hidden", boxShadow: "0 2px 2px 0 rgba(0,0,0,.05)" }}>
      <header style={{ display: "flex", alignItems: "center", padding: 12, gap: 12 }}>
        <button type="button" aria-label={expanded ? "Collapse Health Check Results" : "Expand Health Check Results"} aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)} className="rounded focus-visible:outline-2 focus-visible:outline-blue-600" style={{ padding: 0, background: "transparent", border: 0, cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#747474" strokeWidth="2.5" aria-hidden="true" style={{ transform: expanded ? undefined : "rotate(-90deg)" }}><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, flex: 1, background: "#f3f2f2" }}>
          <span title={allOk ? "All health checks passed" : "Health checks need attention"}><StatusIcon ok={allOk} size={24} /></span>
          <h3 style={{ fontSize: 15.6, fontWeight: 400, color: "#181818", margin: 0, flex: 1 }}>Health Check Results</h3>
          <button type="button" aria-label="Refresh Health Check Results" title="Refresh Health Check Results" disabled={refreshing} onClick={() => startTransition(() => router.refresh())} className="rounded focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50" style={{ padding: 4, border: 0, background: "transparent", cursor: refreshing ? "wait" : "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 520 520" fill="#747474" aria-hidden="true" className={refreshing ? "animate-spin" : undefined}><path d="M465 40h-30c-8 0-15 7-15 15v70c0 9-5 13-12 7l-10-10a210 210 0 10-12 309c7-6 7-16 1-22l-21-21c-5-5-14-6-20-1a152 152 0 01-172 14 152 152 0 0177-281 150 150 0 01118 58c3 8-4 12-13 12h-70c-8 0-15 7-15 15v31c0 8 6 14 14 14h183c7 0 13-6 13-13V55c-1-8-8-15-16-15" /></svg>
          </button>
        </div>
      </header>
      <div id={contentId} hidden={!expanded} aria-live="polite">
        <ul style={{ listStyle: "none", padding: "0 24px 12px", margin: 0 }}>
          {results.map((item, index) => <li key={item.id} style={{ fontSize: 13, lineHeight: "20px", marginTop: index ? 12 : 0, display: "flex", alignItems: "center", gap: 12, color: "#181818" }}><StatusIcon ok={item.ok} /><span>{item.label}</span></li>)}
        </ul>
      </div>
      <span className="sr-only" role="status">{refreshing ? "Refreshing health checks" : ""}</span>
    </article>
  );
}
