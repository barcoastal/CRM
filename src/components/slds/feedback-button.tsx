"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Header feedback widget: one click, three fields, auto-captures the page the
 * user is on. Doubles as the "my reports" status view so people see their
 * feedback goes somewhere.
 */

const TYPE_OPTIONS = [
  { value: "BUG", label: "Something is broken" },
  { value: "PARITY", label: "Looks different from Salesforce" },
  { value: "IDEA", label: "Idea / improvement" },
] as const;

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  NEW: { label: "New", bg: "#eef1f8", color: "#444444" },
  IN_PROGRESS: { label: "In progress", bg: "#fdf3e2", color: "#8c5f10" },
  DONE: { label: "Done", bg: "#eaf5ec", color: "#2e844a" },
  WONT_FIX: { label: "Closed", bg: "#f3f3f3", color: "#747474" },
};

interface MyReport {
  id: string;
  type: string;
  message: string;
  status: string;
  createdAt: string;
}

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("BUG");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<MyReport[]>([]);
  const [shot, setShot] = useState<string | null>(null); // base image data URL
  const [capturing, setCapturing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Paint the captured image onto the annotation canvas (also = clear pen).
  const paintShot = (src: string | null) => {
    if (!src || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const img = new Image();
    img.onload = () => {
      // Keep full resolution (capped) so the saved image stays readable;
      // the canvas is only DISPLAYED small via CSS width: 100%.
      const maxW = 2400;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = src;
  };
  useEffect(() => {
    paintShot(shot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot]);

  const canvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
    };
  };
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    last.current = canvasPos(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const p = canvasPos(e);
    ctx.strokeStyle = "#ea001e";
    // Pen thickness relative to image size so strokes stay visible at full res.
    ctx.lineWidth = Math.max(3, Math.round(canvasRef.current.width / 250));
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const endDraw = () => {
    drawing.current = false;
    last.current = null;
  };

  async function capturePage() {
    setCapturing(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      // Hide the modal while capturing so it does not cover the page.
      const overlayEl = document.getElementById("feedback-overlay");
      if (overlayEl) overlayEl.style.visibility = "hidden";
      const canvas = await html2canvas(document.body, {
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
        logging: false,
      });
      if (overlayEl) overlayEl.style.visibility = "visible";
      setShot(canvas.toDataURL("image/jpeg", 0.85));
    } catch {
      setError("Could not capture the page. You can upload a screenshot file instead.");
    } finally {
      setCapturing(false);
    }
  }

  function uploadShot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setShot(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  useEffect(() => {
    if (!open) return;
    fetch("/api/feedback?mine=1")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setMine(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, [open, sent]);

  async function submit() {
    if (!message.trim()) {
      setError("Tell us what happened or what you want.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const screenshot =
        shot && canvasRef.current ? canvasRef.current.toDataURL("image/jpeg", 0.85) : null;
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message, pageUrl: window.location.href, screenshot }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Could not send, please try again.");
        return;
      }
      setMessage("");
      setShot(null);
      setSent(true);
    } catch {
      setError("Network error, please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="sf-util-btn"
        title="Give feedback"
        onClick={() => {
          setOpen(true);
          setSent(false);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          width: "auto",
          padding: "0 8px",
        }}
      >
        <svg className="sf-util-icon" aria-hidden="true">
          <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#announcement" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#444444", whiteSpace: "nowrap" }}>
          Feedback
        </span>
      </button>

      {open && (
        <div id="feedback-overlay" style={overlay} onClick={() => !busy && setOpen(false)}>
          <div
            style={{
              ...modal,
              // Grow the dialog while annotating so the image is big enough
              // to actually see what you are marking.
              maxWidth: shot && !sent ? "min(1100px, 95vw)" : 440,
              maxHeight: "92vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 4px", fontSize: 16, color: "#181818" }}>Give feedback</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#747474" }}>
              Goes straight to the team with a link to the page you are on.
            </p>

            {sent ? (
              <div
                style={{
                  padding: "10px 12px",
                  background: "#eaf5ec",
                  border: "1px solid #b7e1c2",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#2e844a",
                  marginBottom: 12,
                }}
              >
                Thank you, your feedback was sent.
              </div>
            ) : (
              <>
                <label style={label}>What kind of feedback?</label>
                <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...input, background: "#fff" }}>
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <label style={label}>What happened / what do you want?</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder={
                    type === "PARITY"
                      ? "e.g. In Salesforce this field shows on the left side"
                      : type === "BUG"
                      ? "e.g. Clicking Save on this page shows an error"
                      : "e.g. It would save time if..."
                  }
                  style={{ ...input, height: "auto", padding: 8, resize: "vertical" }}
                />

                <label style={label}>Screenshot (optional)</label>
                {!shot ? (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button type="button" onClick={() => void capturePage()} disabled={capturing} style={btnGhost}>
                      {capturing ? "Capturing..." : "Capture this page"}
                    </button>
                    <label style={{ ...btnGhost, display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                      Upload image
                      <input type="file" accept="image/*" onChange={uploadShot} style={{ display: "none" }} />
                    </label>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: "#747474", marginBottom: 4 }}>
                      Draw on the image to mark what is off (red pen):
                    </div>
                    <canvas
                      ref={canvasRef}
                      onPointerDown={startDraw}
                      onPointerMove={moveDraw}
                      onPointerUp={endDraw}
                      onPointerLeave={endDraw}
                      style={{
                        width: "100%",
                        border: "1px solid #c9c7c5",
                        borderRadius: 4,
                        cursor: "crosshair",
                        touchAction: "none",
                        display: "block",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={() => paintShot(shot)}
                        style={{ ...btnGhost, padding: "3px 10px", fontSize: 12 }}
                      >
                        Clear drawing
                      </button>
                      <button
                        type="button"
                        onClick={() => setShot(null)}
                        style={{ ...btnGhost, padding: "3px 10px", fontSize: 12 }}
                      >
                        Remove screenshot
                      </button>
                    </div>
                  </div>
                )}

                {error && <div style={{ margin: "0 0 10px", fontSize: 13, color: "#c23934" }}>{error}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={() => setOpen(false)} disabled={busy} style={btnGhost}>
                    Cancel
                  </button>
                  <button onClick={submit} disabled={busy} style={btn}>
                    {busy ? "Sending..." : "Send feedback"}
                  </button>
                </div>
              </>
            )}

            {mine.length > 0 && (
              <div style={{ marginTop: 16, borderTop: "1px solid #ecebea", paddingTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#444444", marginBottom: 6 }}>
                  My recent reports
                </div>
                {mine.slice(0, 5).map((m) => {
                  const st = STATUS_STYLE[m.status] ?? STATUS_STYLE.NEW;
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 0",
                        fontSize: 12,
                        borderBottom: "1px solid #f6f6f6",
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          padding: "1px 8px",
                          borderRadius: 10,
                          background: st.bg,
                          color: st.color,
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        {st.label}
                      </span>
                      <span
                        style={{
                          color: "#444444",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.message}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(8,7,7,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1100,
  padding: 16,
};
const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
  width: "100%",
  maxWidth: 440,
  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#444444",
  margin: "0 0 4px",
};
const input: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 8px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
  marginBottom: 12,
  boxSizing: "border-box",
};
const btn: React.CSSProperties = {
  background: "#0176d3",
  border: "none",
  padding: "6px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  color: "#fff",
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  padding: "6px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  color: "#444444",
  cursor: "pointer",
};
