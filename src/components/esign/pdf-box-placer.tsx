"use client";

/**
 * Visual signature/initial/date box placer for e-sign templates.
 *
 * Renders the template PDF page-by-page (pdf.js) and lets you pick a tool
 * (Signature / Initial / Date) and CLICK on the page to drop a box. Boxes are
 * draggable to reposition and deletable. Coordinates are written in the SAME
 * convention the signer flow + pdf-lib stamping already use: PDF points,
 * origin BOTTOM-LEFT, with (x, y) the lower-left corner of the box.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type Box = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

type Kind = "signature" | "initial" | "date" | "text";

const KIND: Record<Kind, { w: number; h: number; label: string; color: string; fill: string }> = {
  signature: { w: 200, h: 40, label: "Signature", color: "#3052ff", fill: "rgba(48,82,255,0.12)" },
  initial: { w: 80, h: 32, label: "Initial", color: "#16a34a", fill: "rgba(22,163,74,0.12)" },
  date: { w: 130, h: 26, label: "Date", color: "#b45309", fill: "rgba(180,83,9,0.12)" },
  text: { w: 200, h: 28, label: "Field", color: "#7c3aed", fill: "rgba(124,58,237,0.10)" },
};

interface PageMeta {
  widthPts: number;
  heightPts: number;
}

interface DragState {
  kind: Kind;
  index: number;
  startPx: number;
  startPy: number;
  origX: number;
  origY: number;
  scale: number;
}

export function PdfBoxPlacer({
  pdfUrl,
  signatureBoxes,
  setSignatureBoxes,
  initialBoxes,
  setInitialBoxes,
  dateBoxes,
  setDateBoxes,
  textBoxes,
  setTextBoxes,
}: {
  pdfUrl: string;
  signatureBoxes: Box[];
  setSignatureBoxes: React.Dispatch<React.SetStateAction<Box[]>>;
  initialBoxes: Box[];
  setInitialBoxes: React.Dispatch<React.SetStateAction<Box[]>>;
  dateBoxes: Box[];
  setDateBoxes: React.Dispatch<React.SetStateAction<Box[]>>;
  textBoxes: Box[];
  setTextBoxes: React.Dispatch<React.SetStateAction<Box[]>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [metas, setMetas] = useState<PageMeta[]>([]);
  const [scale, setScale] = useState(1);
  const [tool, setTool] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // canvases are rendered imperatively; keep the loaded pdf doc around
  const pdfRef = useRef<{ numPages: number; getPage: (n: number) => Promise<unknown> } | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const dragRef = useRef<DragState | null>(null);

  const listFor = useCallback(
    (k: Kind): [Box[], React.Dispatch<React.SetStateAction<Box[]>>] =>
      k === "signature"
        ? [signatureBoxes, setSignatureBoxes]
        : k === "initial"
          ? [initialBoxes, setInitialBoxes]
          : k === "date"
            ? [dateBoxes, setDateBoxes]
            : [textBoxes, setTextBoxes],
    [
      signatureBoxes,
      initialBoxes,
      dateBoxes,
      textBoxes,
      setSignatureBoxes,
      setInitialBoxes,
      setDateBoxes,
      setTextBoxes,
    ],
  );

  function updateLabel(kind: Kind, index: number, label: string) {
    const [, setter] = listFor(kind);
    setter((prev) => prev.map((b, i) => (i === index ? { ...b, label } : b)));
  }

  // Load the PDF + page sizes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const pdfjs = await import("pdfjs-dist");
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        }
        const doc = await pdfjs.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;
        pdfRef.current = doc as unknown as typeof pdfRef.current;
        const m: PageMeta[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const vp = page.getViewport({ scale: 1 });
          m.push({ widthPts: vp.width, heightPts: vp.height });
        }
        if (cancelled) return;
        const containerW = containerRef.current?.clientWidth ?? 800;
        const maxPageW = Math.max(...m.map((p) => p.widthPts), 1);
        // Fit page width to the container (cap at 1.5x so small pages aren't huge).
        const s = Math.min(1.5, Math.max(0.5, (containerW - 4) / maxPageW));
        canvasRefs.current = new Array(m.length).fill(null);
        setMetas(m);
        setScale(s);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load PDF");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // Render each page into its canvas once metas + scale are known.
  useEffect(() => {
    const doc = pdfRef.current;
    if (!doc || metas.length === 0) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < metas.length; i++) {
        const canvas = canvasRefs.current[i];
        if (!canvas) continue;
        const page = (await doc.getPage(i + 1)) as {
          getViewport: (o: { scale: number }) => { width: number; height: number };
          render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
            promise: Promise<void>;
          };
        };
        if (cancelled) return;
        const vp = page.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [metas, scale]);

  // --- coordinate helpers (PDF points, bottom-left origin) ---
  function dropBox(kind: Kind, pageIdx: number, cssX: number, cssY: number) {
    const meta = metas[pageIdx];
    if (!meta) return;
    const def = KIND[kind];
    // place so the box's TOP-LEFT sits at the click, then clamp into the page
    let xPts = cssX / scale;
    let topPts = cssY / scale;
    xPts = Math.max(0, Math.min(xPts, meta.widthPts - def.w));
    topPts = Math.max(0, Math.min(topPts, meta.heightPts - def.h));
    const yPts = meta.heightPts - topPts - def.h; // bottom-left origin
    const box: Box = {
      page: pageIdx + 1,
      x: round2(xPts),
      y: round2(yPts),
      width: def.w,
      height: def.h,
      label: def.label,
    };
    const [, setter] = listFor(kind);
    setter((prev) => [...prev, box]);
  }

  function onPageClick(pageIdx: number, e: React.MouseEvent<HTMLDivElement>) {
    if (!tool) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dropBox(tool, pageIdx, e.clientX - rect.left, e.clientY - rect.top);
  }

  // --- drag to reposition ---
  function onBoxPointerDown(kind: Kind, index: number, e: React.PointerEvent) {
    e.stopPropagation();
    const [boxes] = listFor(kind);
    const b = boxes[index];
    if (!b) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind,
      index,
      startPx: e.clientX,
      startPy: e.clientY,
      origX: b.x,
      origY: b.y,
      scale,
    };
  }
  function onBoxPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    const dxPts = (e.clientX - d.startPx) / d.scale;
    const dyPts = (e.clientY - d.startPy) / d.scale;
    const [boxes, setter] = listFor(d.kind);
    const b = boxes[d.index];
    const meta = metas[b.page - 1];
    if (!b || !meta) return;
    const nx = clamp(d.origX + dxPts, 0, meta.widthPts - b.width);
    // dragging down on screen lowers the box → decrease bottom-left y
    const ny = clamp(d.origY - dyPts, 0, meta.heightPts - b.height);
    setter((prev) => prev.map((x, i) => (i === d.index ? { ...x, x: round2(nx), y: round2(ny) } : x)));
  }
  function onBoxPointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      e.stopPropagation();
      dragRef.current = null;
    }
  }

  function removeBox(kind: Kind, index: number) {
    const [, setter] = listFor(kind);
    setter((prev) => prev.filter((_, i) => i !== index));
  }

  const total =
    signatureBoxes.length + initialBoxes.length + dateBoxes.length + textBoxes.length;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[12px] font-semibold text-[#444656] mr-1">Click a tool, then click the page to drop a box:</span>
        {(Object.keys(KIND) as Kind[]).map((k) => {
          const active = tool === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTool(active ? null : k)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold border"
              style={{
                borderColor: KIND[k].color,
                color: active ? "#fff" : KIND[k].color,
                background: active ? KIND[k].color : "#fff",
              }}
            >
              <span
                className="inline-block size-2.5 rounded-sm"
                style={{ background: active ? "#fff" : KIND[k].color }}
              />
              {KIND[k].label}
            </button>
          );
        })}
        {tool ? (
          <span className="text-[12px] text-[#3052ff] font-semibold">
            Placing {KIND[tool].label} — click the document
          </span>
        ) : (
          <span className="text-[12px] text-[#706e6b]">{total} box{total === 1 ? "" : "es"} placed</span>
        )}
      </div>

      {error ? (
        <div className="text-[12px] text-[#c23934] bg-[#fdecea] border border-[#f5c6c0] rounded px-3 py-2">
          Couldn’t render the PDF: {error}
        </div>
      ) : null}
      {loading ? <div className="text-[12px] text-[#706e6b]">Loading document…</div> : null}

      {/* Pages */}
      <div ref={containerRef} className="space-y-4">
        {metas.map((meta, i) => {
          const cssW = meta.widthPts * scale;
          const cssH = meta.heightPts * scale;
          return (
            <div key={i} className="mx-auto" style={{ width: cssW }}>
              <div className="text-[11px] text-[#706e6b] mb-1">Page {i + 1}</div>
              <div
                onClick={(e) => onPageClick(i, e)}
                className="relative shadow-sm border border-[#d8dde6]"
                style={{ width: cssW, height: cssH, cursor: tool ? "crosshair" : "default", background: "#fff" }}
              >
                <canvas
                  ref={(el) => {
                    canvasRefs.current[i] = el;
                  }}
                  style={{ width: cssW, height: cssH, display: "block" }}
                />
                {/* Overlay boxes for this page */}
                {(Object.keys(KIND) as Kind[]).flatMap((kind) => {
                  const [boxes] = listFor(kind);
                  return boxes
                    .map((b, idx) => ({ b, idx }))
                    .filter(({ b }) => b.page === i + 1)
                    .map(({ b, idx }) => {
                      const left = b.x * scale;
                      const top = (meta.heightPts - b.y - b.height) * scale;
                      const w = b.width * scale;
                      const h = b.height * scale;
                      const def = KIND[kind];
                      const isText = kind === "text";
                      return (
                        <div
                          key={`${kind}-${idx}`}
                          onPointerDown={isText ? undefined : (e) => onBoxPointerDown(kind, idx, e)}
                          onPointerMove={isText ? undefined : onBoxPointerMove}
                          onPointerUp={isText ? undefined : onBoxPointerUp}
                          className="absolute flex items-center justify-center select-none"
                          style={{
                            left,
                            top,
                            width: w,
                            height: h,
                            border: `2px solid ${def.color}`,
                            background: def.fill,
                            borderRadius: 3,
                            cursor: isText ? "default" : "move",
                            touchAction: "none",
                          }}
                          title={isText ? def.label : `${def.label} — drag to move`}
                        >
                          {isText ? (
                            <>
                              {/* drag handle */}
                              <span
                                onPointerDown={(e) => onBoxPointerDown(kind, idx, e)}
                                onPointerMove={onBoxPointerMove}
                                onPointerUp={onBoxPointerUp}
                                className="text-[11px] font-bold px-1"
                                style={{ color: def.color, cursor: "move", touchAction: "none" }}
                                title="Drag to move"
                              >
                                ⠿
                              </span>
                              <input
                                value={b.label ?? ""}
                                onChange={(e) => updateLabel(kind, idx, e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="Field label"
                                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[11px] font-semibold"
                                style={{ color: def.color }}
                              />
                            </>
                          ) : (
                            <span
                              className="text-[10px] font-semibold pointer-events-none"
                              style={{ color: def.color }}
                            >
                              {b.label ?? def.label}
                            </span>
                          )}
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBox(kind, idx);
                            }}
                            className="absolute -top-2.5 -right-2.5 size-5 rounded-full text-white text-[11px] leading-none flex items-center justify-center shadow"
                            style={{ background: def.color }}
                            aria-label={`Remove ${def.label}`}
                          >
                            ×
                          </button>
                        </div>
                      );
                    });
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(n, hi));
}
