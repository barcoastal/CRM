"use client";
import { useEffect, useMemo, useRef, useState } from "react";
type AdoptStyle = "type-1" | "type-2" | "type-3" | "type-4" | "draw";

const TYPE_FONTS: { id: AdoptStyle; label: string; family: string }[] = [
  {
    id: "type-1",
    label: "Allura",
    family: "'Brush Script MT', 'Lucida Handwriting', cursive",
  },
  {
    id: "type-2",
    label: "Caveat",
    family: "'Bradley Hand', 'Comic Sans MS', cursive",
  },
  {
    id: "type-3",
    label: "Pinyon",
    family: "'Snell Roundhand', 'Apple Chancery', cursive",
  },
  { id: "type-4", label: "Italic", family: "'Times New Roman', serif" },
];

export function AdoptModal({
  kind,
  fullName,
  setFullName,
  onCancel,
  onAdopt,
}: {
  kind: "signature" | "initial";
  fullName: string;
  setFullName: (s: string) => void;
  onCancel: () => void;
  onAdopt: (dataUrl: string) => void;
}) {
  const [tab, setTab] = useState<"type" | "draw">("type");
  const [styleId, setStyleId] = useState<AdoptStyle>("type-1");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const display = useMemo(() => {
    if (kind === "initial") {
      return fullName
        .split(/\s+/)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("");
    }
    return fullName;
  }, [fullName, kind]);

  useEffect(() => {
    if (tab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a1a3d";
  }, [tab]);

  function ptFrom(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = ptFrom(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = ptFrom(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  }
  function onUp() {
    drawing.current = false;
    last.current = null;
  }
  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  function rasterTypedSignature(): string {
    const W = 600;
    const H = 200;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const family =
      TYPE_FONTS.find((f) => f.id === styleId)?.family ?? "cursive";
    const fontSize = kind === "initial" ? 110 : 80;
    ctx.font = `italic ${fontSize}px ${family}`;
    ctx.fillStyle = "#0a1a3d";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(display, W / 2, H / 2);
    return c.toDataURL("image/png");
  }

  function adopt() {
    if (tab === "type") {
      onAdopt(rasterTypedSignature());
    } else {
      const c = canvasRef.current;
      if (!c || !hasInk) return;
      onAdopt(c.toDataURL("image/png"));
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: "0 0 auto",
        height: "var(--signing-height, 100dvh)",
        background: "rgba(8,13,30,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          width: "100%",
          maxWidth: 600,
          maxHeight: "100%",
          overflowY: "auto",
        }}
      >
        <div
          style={{ padding: "16px 20px", borderBottom: "1px solid #e6e6e6" }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#131b2e",
              margin: 0,
            }}
          >
            Adopt your {kind === "signature" ? "signature" : "initials"}
          </h2>
          <p style={{ fontSize: 12, color: "#747474", margin: "4px 0 0" }}>
            Adopt once, then click each required location to apply your{" "}
            {kind === "signature" ? "signature" : "initials"}. Use Next to move
            through the document.
          </p>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 11,
                color: "#747474",
                textTransform: "uppercase",
                letterSpacing: 0.4,
                fontWeight: 700,
                display: "block",
                marginBottom: 4,
              }}
            >
              Full Name
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid #c9c9c9",
                borderRadius: 4,
                fontSize: 16,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "1px solid #e6e6e6",
              marginBottom: 16,
            }}
          >
            {(["type", "draw"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: 0,
                  borderBottom:
                    tab === t ? "2px solid #3052ff" : "2px solid transparent",
                  color: tab === t ? "#3052ff" : "#444656",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "type" ? (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {TYPE_FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStyleId(f.id)}
                    style={{
                      padding: 16,
                      background: "#fff",
                      border:
                        styleId === f.id
                          ? "2px solid #3052ff"
                          : "1px solid #c9c9c9",
                      borderRadius: 4,
                      cursor: "pointer",
                      textAlign: "center",
                      minHeight: 70,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#747474",
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        marginBottom: 4,
                      }}
                    >
                      {f.label}
                    </div>
                    <div
                      style={{
                        fontFamily: f.family,
                        fontSize: kind === "initial" ? 32 : 22,
                        color: "#0a1a3d",
                        fontStyle: "italic",
                      }}
                    >
                      {display || "Your name"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <canvas
                ref={canvasRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={onUp}
                style={{
                  width: "100%",
                  height: 180,
                  border: "1px solid #c9c9c9",
                  borderRadius: 4,
                  touchAction: "none",
                  background: "#fff",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <button
                  onClick={clearCanvas}
                  style={{
                    background: "transparent",
                    border: 0,
                    color: "#3052ff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
                <span style={{ fontSize: 11, color: "#747474" }}>
                  {hasInk ? "Ready" : "Draw above"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e6e6e6",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              background: "#fff",
              border: "1px solid #c9c9c9",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: "#444656",
            }}
          >
            Cancel
          </button>
          <button
            onClick={adopt}
            disabled={tab === "draw" && !hasInk}
            style={{
              padding: "8px 20px",
              background:
                tab === "draw" && !hasInk
                  ? "#c9c9c9"
                  : "linear-gradient(135deg, #0034e4, #3052ff)",
              color: "#fff",
              border: 0,
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 700,
              cursor: tab === "draw" && !hasInk ? "not-allowed" : "pointer",
            }}
          >
            Adopt and Sign
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeclineModal({
  reason,
  setReason,
  onCancel,
  onConfirm,
}: {
  reason: string;
  setReason: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: "0 0 auto",
        height: "var(--signing-height, 100dvh)",
        background: "rgba(8,13,30,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          width: "100%",
          maxWidth: 480,
          maxHeight: "100%",
          overflowY: "auto",
          padding: 24,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#131b2e",
            margin: "0 0 8px",
          }}
        >
          Decline to sign
        </h2>
        <p style={{ fontSize: 13, color: "#444656", margin: "0 0 12px" }}>
          The sender will be notified that you declined this document. Please
          share a brief reason.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for declining..."
          style={{
            width: "100%",
            minHeight: 100,
            padding: 10,
            border: "1px solid #c9c9c9",
            borderRadius: 4,
            fontSize: 16,
            color: "#131b2e",
            resize: "vertical",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              background: "#fff",
              border: "1px solid #c9c9c9",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: "#444656",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!reason.trim()}
            style={{
              padding: "8px 20px",
              background: reason.trim() ? "#942b00" : "#c9c9c9",
              color: "#fff",
              border: 0,
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 700,
              cursor: reason.trim() ? "pointer" : "not-allowed",
            }}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
