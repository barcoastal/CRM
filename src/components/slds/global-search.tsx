"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  entity: "Lead" | "Contact" | "Account" | "Opportunity";
  title: string;
  subtitle: string;
}

const ENTITY_PATH: Record<SearchResult["entity"], string> = {
  Lead: "/leads",
  Contact: "/contacts",
  Account: "/accounts",
  Opportunity: "/opportunities",
};

const ENTITY_COLOR: Record<SearchResult["entity"], string> = {
  Lead: "#0176d3",
  Contact: "#04844b",
  Account: "#df9f00",
  Opportunity: "#cf3476",
};

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = await res.json() as { results: SearchResult[] };
        setResults(data.results ?? []);
        setOpen(true);
        setActiveIdx(0);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const go = (r: SearchResult) => {
    setOpen(false);
    setQ("");
    router.push(`${ENTITY_PATH[r.entity]}/${r.id}`);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (results[activeIdx]) {
        e.preventDefault();
        go(results[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1, maxWidth: 600, margin: "0 auto" }}>
      <div className="sf-search">
        <svg className="sf-search-icon" aria-hidden="true">
          <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#search" />
        </svg>
        <input
          ref={inputRef}
          className="sf-search-input"
          placeholder="Search..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={onKey}
          autoComplete="off"
        />
      </div>
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "#fff",
          border: "1px solid #c9c9c9",
          borderRadius: 4,
          boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
          maxHeight: 480,
          overflowY: "auto",
          zIndex: 9999,
        }}>
          {loading && (
            <div style={{ padding: 12, fontSize: 13, color: "#747474" }}>Searching…</div>
          )}
          {!loading && results.length === 0 && q.trim().length >= 2 && (
            <div style={{ padding: 12, fontSize: 13, color: "#747474" }}>No results.</div>
          )}
          {!loading && results.map((r, i) => (
            <button
              key={`${r.entity}-${r.id}`}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => go(r)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                border: 0,
                background: i === activeIdx ? "#f3f2f2" : "transparent",
                padding: "8px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #f3f2f2",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  display: "inline-block",
                  padding: "2px 6px",
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fff",
                  background: ENTITY_COLOR[r.entity],
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}>
                  {r.entity}
                </span>
                <span style={{ fontWeight: 600, color: "#181818" }}>{r.title}</span>
              </div>
              {r.subtitle && (
                <div style={{ fontSize: 12, color: "#747474", marginTop: 2, marginLeft: 56 }}>{r.subtitle}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
