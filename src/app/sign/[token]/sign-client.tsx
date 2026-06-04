"use client";

import { useEffect, useRef, useState } from "react";

export function SignClient({
  token,
  envelopeId,
  signerName,
  documentUrl,
}: {
  token: string;
  envelopeId: string;
  signerName: string;
  documentUrl: string | null;
}) {
  const [name, setName] = useState(signerName);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  // Mark as viewed on first load
  useEffect(() => {
    fetch(`/api/sign/${token}/view`, { method: "POST" }).catch(() => undefined);
  }, [token]);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#16325c";
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    lastPtRef.current = getPos(e);
    setIsEmpty(false);
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pt = getPos(e);
    const last = lastPtRef.current!;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPtRef.current = pt;
  }

  function endDraw() {
    drawingRef.current = false;
    lastPtRef.current = null;
  }

  function clearSig() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  }

  async function submit() {
    setError(null);
    if (!agreed) {
      setError("Please accept the terms before signing.");
      return;
    }
    if (isEmpty || !canvasRef.current) {
      setError("Please draw your signature.");
      return;
    }
    setSubmitting(true);
    try {
      const dataUrl = canvasRef.current.toDataURL("image/png");
      const res = await fetch(`/api/sign/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureImage: dataUrl, signerName: name }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "Sign failed" }));
        throw new Error(msg ?? "Sign failed");
      }
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={card}>
        <div style={{ fontSize: 20, color: "#04844b", marginBottom: 8 }}>✓ Signed</div>
        <p style={{ fontSize: 13 }}>
          Your signature has been recorded. A copy of the signed document will be emailed to you.
        </p>
      </div>
    );
  }

  return (
    <div>
      {documentUrl ? (
        <div style={{ ...card, padding: 0, marginBottom: 16, overflow: "hidden" }}>
          <iframe
            src={documentUrl}
            style={{ width: "100%", height: 600, border: 0 }}
            title="Document preview"
          />
        </div>
      ) : (
        <div style={{ ...card, marginBottom: 16, textAlign: "center", color: "#706e6b" }}>
          (Document preview not available.)
        </div>
      )}

      <div style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Add your signature</h2>

        <label style={label}>Full Legal Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
          placeholder="Your full legal name"
        />

        <label style={{ ...label, marginTop: 16 }}>Signature</label>
        <div
          style={{
            border: "1px dashed #c9c7c5",
            borderRadius: 4,
            background: "#fafaf9",
            position: "relative",
            touchAction: "none",
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            style={{ width: "100%", height: 160, display: "block", cursor: "crosshair" }}
          />
          {isEmpty && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                color: "#b0adab",
                fontSize: 13,
              }}
            >
              Draw your signature here
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", marginTop: 6 }}>
          <button
            onClick={clearSig}
            style={{
              background: "transparent",
              border: 0,
              color: "#0070d2",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>

        <label style={{ display: "flex", gap: 8, marginTop: 16, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I agree that the electronic signature above is the legal equivalent of my handwritten
            signature and that I am signing this document under the U.S. ESIGN Act.
          </span>
        </label>

        {error && (
          <div style={{ color: "#c23934", fontSize: 12, marginTop: 8 }}>{error}</div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          style={{
            background: "#0070d2",
            color: "#fff",
            border: 0,
            padding: "10px 24px",
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 700,
            cursor: submitting ? "wait" : "pointer",
            marginTop: 16,
          }}
        >
          {submitting ? "Signing…" : "Sign Document"}
        </button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  padding: 24,
  marginBottom: 16,
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#3e3e3c",
  marginBottom: 4,
};
const input: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
};
