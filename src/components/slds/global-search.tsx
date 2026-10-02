"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SEARCH_TYPES,
  normalizeSearchQuery,
  searchHref,
  type SearchRow,
} from "@/lib/search-types";

function SearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = pathname === "/search" ? params.get("q") || "" : "";
  const [q, setQ] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalized = normalizeSearchQuery(q);

  useEffect(() => {
    setQ(urlQuery);
    setOpen(false);
  }, [pathname, urlQuery]);
  useEffect(() => {
    setResults([]);
    setError(false);
    setLoading(false);
    if (!open || normalized.length < 2) return;
    let active = true;
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(normalized)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        if (active) setResults(data.results || []);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [normalized, open]);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function shortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", shortcut);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", shortcut);
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (normalized.length < 2) return;
    setOpen(false);
    inputRef.current?.blur();
    router.push(searchHref(normalized));
  }
  function menuKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      inputRef.current?.focus();
      setOpen(false);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>(
        "[data-search-choice]",
      ) || [],
    );
    if (!buttons.length) return;
    e.preventDefault();
    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const next =
      e.key === "ArrowDown"
        ? Math.min(buttons.length - 1, current + 1)
        : current - 1;
    if (next < 0) inputRef.current?.focus();
    else buttons[next]?.focus();
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", flex: 1, maxWidth: 600, margin: "0 auto" }}
      onKeyDown={menuKey}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <form role="search" onSubmit={submit}>
        <div className="sf-search">
          <svg className="sf-search-icon" aria-hidden="true">
            <use href="/slds/icons/utility-sprite/svg/symbols.svg#search" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className="sf-search-input"
            aria-label="Search CRM"
            placeholder="Search..."
            value={q}
            maxLength={200}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            autoComplete="off"
            aria-expanded={open && normalized.length >= 2}
            aria-controls={
              open && normalized.length >= 2
                ? "global-search-suggestions"
                : undefined
            }
          />
        </div>
      </form>
      {open && normalized.length >= 2 && (
        <div
          id="global-search-suggestions"
          aria-label="Search suggestions"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #c9c9c9",
            borderRadius: 4,
            boxShadow: "0 4px 16px rgba(0,0,0,.16)",
            maxHeight: 480,
            overflowY: "auto",
            zIndex: 9999,
          }}
        >
          <button
            type="button"
            data-search-choice
            onClick={() => {
              setOpen(false);
              inputRef.current?.blur();
              router.push(searchHref(normalized));
            }}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              width: "100%",
              padding: "12px 14px",
              textAlign: "left",
              color: "#0176d3",
              background: "#f3f8fc",
              border: 0,
              borderBottom: "1px solid #dddbda",
              cursor: "pointer",
            }}
          >
            <span>
              Show all results for <strong>{normalized}</strong>
            </span>
            <span style={{ color: "#706e6b", fontSize: 12 }}>Enter ↵</span>
          </button>
          {loading && (
            <div role="status" style={{ padding: 12 }}>
              Searching…
            </div>
          )}
          {!loading && error && (
            <div role="status" style={{ padding: 12 }}>
              Suggestions are unavailable. Press Enter to search again.
            </div>
          )}
          {!loading && !error && results.length === 0 && (
            <div style={{ padding: 12, color: "#706e6b" }}>
              No matching suggestions.
            </div>
          )}
          {!loading &&
            results.map((result) => (
              <button
                type="button"
                data-search-choice
                key={`${result.entity}-${result.id}`}
                onClick={() => {
                  setOpen(false);
                  setQ("");
                  router.push(result.href);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 14px",
                  textAlign: "left",
                  background: "#fff",
                  border: 0,
                  borderBottom: "1px solid #f3f2f2",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background:
                        SEARCH_TYPES.find((t) => t.entity === result.entity)
                          ?.color || "#5c799e",
                      color: "white",
                    }}
                  >
                    {result.entity}
                  </span>
                  <span style={{ fontWeight: 600 }}>{result.title}</span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#706e6b",
                    marginTop: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {result.subtitle}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export function GlobalSearch() {
  return (
    <Suspense
      fallback={
        <div className="sf-search">
          <input
            className="sf-search-input"
            placeholder="Search..."
            aria-label="Search CRM"
            disabled
          />
        </div>
      }
    >
      <SearchInput />
    </Suspense>
  );
}
