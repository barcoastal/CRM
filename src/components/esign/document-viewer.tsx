"use client";
import { useEffect, useRef, useState } from "react";
import { Search, FileText, Download, Printer, ZoomIn, ZoomOut, Sparkles, X } from "lucide-react";
import { documentHighlights } from "@/lib/esign/document-highlights";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { SigningField } from "@/lib/esign/fields";
import styles from "./signing.module.css";
export function DocumentViewer({
  url,
  editorMode = false,
  envelopeId,
  onStart,
  fields,
  activeId,
  renderField,
  onReady,
  onError,
  documents = [],
  onPageClick,
  onFieldMove,
}: {
  url: string;
  envelopeId?: string;
  onStart?: () => void;
  editorMode?: boolean;
  fields: SigningField[];
  activeId?: string | null;
  renderField: (f: SigningField) => React.ReactNode;
  onPageClick?: (page: number, x: number, y: number) => void;
  onFieldMove?: (id: string, x: number, y: number) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  documents?: { name: string; startPage: number; pageCount: number }[];
}) {
  const [pages, setPages] = useState<{ width: number; height: number }[]>([]);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(1);
  const [error, setError] = useState("");
  const [showPages, setShowPages] = useState(editorMode);
  const [search, setSearch] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<{page:number;text:string}[] | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [searched, setSearched] = useState(false);
  const [toolError, setToolError] = useState("");
  const [matches, setMatches] = useState<number[]>([]);
  const pdf = useRef<PDFDocumentProxy | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const ready = useRef(onReady);
  ready.current = onReady;
  const failed = useRef(onError);
  failed.current = onError;
  useEffect(() => {
    let cancelled = false;
    let task:
      ReturnType<(typeof import("pdfjs-dist"))["getDocument"]> | undefined;
    (async () => {
      try {
        setError("");
        setPages([]);
        const lib = await import("pdfjs-dist");
        lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
        task = lib.getDocument({ url, isEvalSupported: false });
        const doc = await task.promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        pdf.current = doc;
        const sizes = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const view = page.getViewport({ scale: 1 });
          sizes.push({ width: view.width, height: view.height });
        }
        if (!cancelled) setPages(sizes);
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error ? e.message : "Document could not be opened";
          setError(msg);
          failed.current?.(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
      pdf.current = null;
    };
  }, [url]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setFit(
        Math.min(
          1.35,
          Math.max(
            0.2,
            (el.clientWidth -
              parseFloat(getComputedStyle(el).paddingLeft) -
              parseFloat(getComputedStyle(el).paddingRight)) /
              Math.max(...pages.map((p) => p.width), 612),
          ),
        ),
      ),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pages]);
  const scale = fit * zoom;
  useEffect(() => {
    let cancelled = false;
    const tasks: { cancel: () => void }[] = [];
    (async () => {
      const doc = pdf.current;
      if (!doc) return;
      try {
        for (let i = 0; i < pages.length; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i + 1);
          const canvas = canvases.current[i];
          if (!canvas || cancelled) continue;
          const viewport = page.getViewport({
            scale: Math.min(scale * window.devicePixelRatio, 2.5),
          });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext("2d");
          if (!context) continue;
          const task = page.render({ canvasContext: context, viewport });
          tasks.push(task);
          await task.promise;
        }
        if (!cancelled && pages.length) ready.current?.();
      } catch (e) {
        if (!cancelled) {
          setError("Document rendering failed. Reload to try again.");
          failed.current?.(String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
      tasks.forEach((t) => t.cancel());
    };
  }, [pages, scale]);
  useEffect(() => {
    if (!activeId) return;
    const target = area.current?.querySelector<HTMLElement>(
      `[data-field-id="${activeId}"]`,
    );
    target?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
    // Mobile fields are edited in the readable panel, not inside the scaled PDF.
    // Never open the keyboard just because Next moved to a field.
    if (!window.matchMedia("(max-width: 700px)").matches) {
      target
        ?.querySelector<HTMLElement>("button,input,select")
        ?.focus({ preventScroll: true });
    }
  }, [activeId, pages]);
  async function find() {
    const doc = pdf.current;
    if (!doc || !search.trim()) {
      setMatches([]);
      return;
    }
    const found: number[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const text = await (await doc.getPage(i)).getTextContent();
      if (
        text.items
          .map((t) => ("str" in t ? t.str : ""))
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        found.push(i);
    }
    setMatches(found);
    setSearched(true);
  }
  async function summarize() {
    if (!pdf.current) return;
    setSummarizing(true); setToolError("");
    try {
      const texts: string[] = [];
      for (let n=1; n<=pdf.current.numPages; n++) {
        const text = await (await pdf.current.getPage(n)).getTextContent();
        texts.push(text.items.map(item => "str" in item ? item.str : "").join(" "));
      }
      setSummary(documentHighlights(texts));
    } catch { setToolError("Could not read the document. Please try again."); }
    finally { setSummarizing(false); }
  }
  async function download() {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const blob = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href=blob; link.download="Coastal-Sign-document.pdf"; link.click();
      setTimeout(()=>URL.revokeObjectURL(blob), 30000);
    } catch { setToolError("Download failed. Please try again."); }
  }
  function print() {
    const frame = document.createElement("iframe");
    frame.style.cssText="position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    frame.src=url;
    frame.onload=()=>{ try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { setToolError("Open the downloaded PDF to print from your device."); } };
    document.body.appendChild(frame);
    setTimeout(()=>frame.remove(),60000);
  }
  function go(page: number) {
    area.current
      ?.querySelector(`[data-page="${page}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.matchMedia("(max-width: 700px)").matches) setShowPages(false);
  }
  return (
    <div
      className={`${styles.viewerShell} ${editorMode ? styles.editorViewer : ""}`}
      style={{ "--document-scale": scale } as React.CSSProperties}
    >
      {editorMode && (
        <div className={styles.editorToolbar} aria-label="Document toolbar">
          <button
            type="button"
            onClick={() => setZoom((v) => Math.max(0.5, v - 0.15))}
            aria-label="Zoom out"
          >
            −
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((v) => Math.min(2, v + 0.15))}
            aria-label="Zoom in"
          >
            +
          </button>
          <button type="button" onClick={() => setZoom(1)}>
            Fit
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Download
          </a>
          <button
            type="button"
            aria-pressed={showPages}
            onClick={() => setShowPages((v) => !v)}
          >
            Documents
          </button>
        </div>
      )}
      {toolError && <div className={styles.toolError} role="alert">{toolError}<button onClick={()=>setToolError("")} aria-label="Dismiss error">×</button></div>}
      {showPages && (
        <nav className={styles.pages} aria-label="Document pages">
          <h3>Documents</h3>
          {documents.length > 0
            ? documents.map((d) => (
                <details key={d.startPage} open>
                  <summary>{d.name}</summary>
                  <small>Pages: {d.pageCount}</small>
                  {Array.from({ length: d.pageCount }, (_, i) => (
                    <button key={i} onClick={() => go(d.startPage + i)}>
                      <PageThumbnail
                        doc={pdf.current}
                        pageNumber={d.startPage + i}
                      />
                      Page {i + 1}
                    </button>
                  ))}
                </details>
              ))
            : pages.map((_, i) => (
                <button key={i} onClick={() => go(i + 1)}>
                  <PageThumbnail doc={pdf.current} pageNumber={i + 1} />
                  Page {i + 1}
                  {fields.some((f) => f.page === i + 1) ? " •" : ""}
                </button>
              ))}
        </nav>
      )}
      <div className={styles.documentArea} ref={area}>
        {error ? (
          <div role="alert" className={styles.error}>
            {error}
          </div>
        ) : !pages.length ? (
          <div className={styles.loading}>Opening your documents…</div>
        ) : null}
        {pages.map((p, i) => (
          <section
            key={i}
            data-page={i + 1}
            aria-label={`Document page ${i + 1}`}
            className={styles.paper}
            onClick={(e) => {
              if (onPageClick) {
                const r = e.currentTarget.getBoundingClientRect();
                onPageClick(
                  i + 1,
                  (e.clientX - r.left) / scale,
                  p.height - (e.clientY - r.top) / scale,
                );
              }
            }}
            style={{ width: p.width * scale, height: p.height * scale }}
          >
            {envelopeId && <div className={styles.envelopeStamp}>Coastal Sign Envelope ID: {envelopeId}</div>}
            {i === 0 && onStart && !activeId && <button className={styles.startFlag} onClick={onStart}>Start</button>}
            <canvas
              ref={(el) => {
                canvases.current[i] = el;
              }}
              aria-label={`PDF page ${i + 1}`}
              style={{ width: "100%", height: "100%" }}
            />
            {fields
              .filter((f) => f.page === i + 1)
              .map((f) => (
                <div
                  key={f.id}
                  data-field-id={f.id}
                  data-editable={!!onFieldMove}
                  data-action={
                    f.kind === "signature"
                      ? "Sign →"
                      : f.kind === "initial"
                        ? "Initial →"
                        : "Fill →"
                  }
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => {
                    if (!onFieldMove) return;
                    const startX = e.clientX,
                      startY = e.clientY;
                    const move = (v: PointerEvent) =>
                      onFieldMove(
                        f.id,
                        Math.max(
                          0,
                          Math.min(
                            p.width - f.width,
                            f.x + (v.clientX - startX) / scale,
                          ),
                        ),
                        Math.max(
                          0,
                          Math.min(
                            p.height - f.height,
                            f.y - (v.clientY - startY) / scale,
                          ),
                        ),
                      );
                    const end = () => {
                      window.removeEventListener("pointermove", move);
                      window.removeEventListener("pointerup", end);
                    };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", end, { once: true });
                  }}
                  className={`${styles.field} ${activeId === f.id ? styles.activeField : ""}`}
                  style={{
                    left: `${(f.x / p.width) * 100}%`,
                    top: `${((p.height - f.y - f.height) / p.height) * 100}%`,
                    width: `${(f.width / p.width) * 100}%`,
                    height: `${(f.height / p.height) * 100}%`,
                  }}
                >
                  {renderField(f)}
                </div>
              ))}
            <span className={styles.pageNumber}>
              Page {i + 1} of {pages.length}
            </span>
          </section>
        ))}
      </div>
      {!editorMode && showSummary && <section className={styles.summaryPanel} aria-label="Agreement highlights">
        <button className={styles.closePanel} onClick={()=>setShowSummary(false)} aria-label="Close summary"><X size={22}/></button>
        <span className={styles.summaryBadge}>Document highlights</span>
        <h2>Review this agreement</h2>
        <p>Find key passages with links to their pages. These are excerpts from the document; review the full agreement before signing.</p>
        {summary === null ? <button className={styles.primary} disabled={summarizing || !pages.length} onClick={summarize}>{summarizing ? "Reading document…" : "Generate highlights"}</button> : summary.length ? <ul>{summary.map((item,i)=><li key={i}><p>{item.text}</p><button onClick={()=>go(item.page)}>View page {item.page}</button></li>)}</ul> : <p>No extractable highlights found. Use View pages to review the document.</p>}
      </section>}
      {!editorMode && (
        <aside className={styles.viewerTools} aria-label="Document tools">
          <button onClick={()=>{setShowSummary(v=>!v);setShowPages(false);}} aria-label="Summarize agreement" aria-pressed={showSummary}><Sparkles size={24}/><span>Summarize</span></button>
          <button
            onClick={() => setShowPages((v) => !v)}
            aria-pressed={showPages}
            aria-label="View pages"
          >
            <FileText size={24}/><span>View pages</span>
          </button>
          <details>
            <summary aria-label="Search document">
              <Search size={24}/><span>Search</span>
            </summary>
            <div className={styles.search}>
              <input
                aria-label="Search document"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void find();
                }}
              />
              <button onClick={find}>Find</button>
              {searched && !matches.length && <p>No matching pages.</p>}
              {matches.map((p) => (
                <button key={p} onClick={() => go(p)}>
                  Page {p}
                </button>
              ))}
            </div>
          </details>
          <button onClick={download} aria-label="Download document"><Download size={24}/><span>Download</span></button>
          <button onClick={print} aria-label="Print document"><Printer size={24}/><span>Print</span></button>
          <div className={styles.zoom}>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom((v) => Math.min(2, v + 0.15))}
            >
              <ZoomIn size={24}/>
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button
              aria-label="Zoom out"
              onClick={() => setZoom((v) => Math.max(0.5, v - 0.15))}
            >
              <ZoomOut size={24}/>
            </button>
            <button onClick={() => setZoom(1)}>Fit</button>
          </div>
        </aside>
      )}
    </div>
  );
}

function PageThumbnail({
  doc,
  pageNumber,
}: {
  doc: PDFDocumentProxy | null;
  pageNumber: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void } | undefined;
    if (doc)
      void (async () => {
        try {
          const page = await doc.getPage(pageNumber);
          if (cancelled || !ref.current) return;
          const v = page.getViewport({ scale: 0.24 });
          const c = ref.current;
          c.width = v.width;
          c.height = v.height;
          const ctx = c.getContext("2d");
          if (ctx) {
            const render = page.render({ canvasContext: ctx, viewport: v });
            task = render;
            await render.promise;
          }
        } catch {
          /* Main document view reports load errors. */
        }
      })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        marginBottom: 6,
        background: "white",
      }}
    />
  );
}
