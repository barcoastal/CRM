"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Box = { page: number; x: number; y: number; width: number; height: number; label?: string };

type Props = {
  token: string;
  envelopeId: string;
  signerName: string;
  signerEmail: string;
  documentName: string;
  templateName: string;
  signatureBoxes: Box[];
  initialBoxes: Box[];
  dateBoxes: Box[];
  textBoxes: Box[];
  checkboxBoxes: Box[];
};

type AdoptStyle = "type-1" | "type-2" | "type-3" | "type-4" | "draw";

const TYPE_FONTS: { id: AdoptStyle; label: string; family: string }[] = [
  { id: "type-1", label: "Allura", family: "'Brush Script MT', 'Lucida Handwriting', cursive" },
  { id: "type-2", label: "Caveat", family: "'Bradley Hand', 'Comic Sans MS', cursive" },
  { id: "type-3", label: "Pinyon", family: "'Snell Roundhand', 'Apple Chancery', cursive" },
  { id: "type-4", label: "Italic", family: "'Times New Roman', serif" },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SignClient({
  token,
  envelopeId,
  signerName,
  signerEmail,
  documentName,
  templateName,
  signatureBoxes,
  initialBoxes,
  dateBoxes,
  textBoxes,
  checkboxBoxes,
}: Props) {
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [adoptKind, setAdoptKind] = useState<"signature" | "initial">("signature");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [initialDataUrl, setInitialDataUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState(signerName);
  const [dateValues, setDateValues] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    dateBoxes.forEach((_, i) => (d[String(i)] = todayStr()));
    return d;
  });
  const [textValues, setTextValues] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    textBoxes.forEach((_, i) => (d[String(i)] = ""));
    return d;
  });
  const [checkboxValues, setCheckboxValues] = useState<Record<string, boolean>>(() => {
    const d: Record<string, boolean> = {};
    checkboxBoxes.forEach((_, i) => (d[String(i)] = false));
    return d;
  });
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const allTextFilled = textBoxes.every((_, i) => (textValues[String(i)] ?? "").trim() !== "");
  const allBoxesReady =
    (signatureBoxes.length === 0 || signatureDataUrl !== null) && allTextFilled;

  function openAdopt(kind: "signature" | "initial") {
    setAdoptKind(kind);
    setAdoptOpen(true);
  }

  async function finish() {
    if (!signatureDataUrl) {
      setError("Please adopt a signature first.");
      return;
    }
    if (!allTextFilled) {
      setError("Please fill in all required fields on the document.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/esign/envelopes/by-token/${token}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: signatureDataUrl,
          initial: initialDataUrl ?? signatureDataUrl,
          dateValues,
          textValues,
          checkboxValues,
          fullName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to sign.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign.");
      setSubmitting(false);
    }
  }

  async function decline() {
    if (!declineReason.trim()) return;
    const res = await fetch(`/api/esign/envelopes/by-token/${token}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: declineReason.trim() }),
    });
    if (res.ok) window.location.reload();
    else alert("Failed to decline.");
  }

  if (done) {
    return (
      <div style={{ background: "#f4f6f9", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 8, maxWidth: 520, padding: 36, textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e8fbe9", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1a7d37" strokeWidth="3">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#131b2e", marginBottom: 8 }}>You did it!</h1>
          <p style={{ fontSize: 14, color: "#444656", marginBottom: 24 }}>
            Thank you for signing. The signed copy has been delivered to you and the sender by email.
          </p>
          <a
            href={`/api/esign/envelopes/by-token/${token}/signed-pdf`}
            target="_blank"
            rel="noopener"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "#3052ff",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Download signed copy
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fafafa", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{
        background: "#fff",
        borderBottom: "1px solid #e6e6e6",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 4, background: "#3052ff", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>C</div>
          <div>
            <div style={{ fontSize: 11, color: "#747474", textTransform: "uppercase", letterSpacing: 0.4 }}>{templateName}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#131b2e" }}>{documentName}</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: "#444656", textAlign: "right" }}>
          <div>{signerName}</div>
          <div style={{ color: "#747474" }}>{signerEmail}</div>
        </div>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setActionsOpen((o) => !o)}
            style={{ padding: "8px 14px", background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#444656" }}
          >
            Other Actions ▼
          </button>
          {actionsOpen && (
            <div style={{ position: "absolute", right: 0, top: 36, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, minWidth: 200, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 10 }}>
              <button
                onClick={() => { setDeclineOpen(true); setActionsOpen(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: 0, fontSize: 13, color: "#942b00", cursor: "pointer" }}
              >
                Decline to sign
              </button>
              <a
                href="mailto:support@coastaldebt.com?subject=Help signing document"
                onClick={() => setActionsOpen(false)}
                style={{ display: "block", padding: "10px 14px", fontSize: 13, color: "#3052ff", textDecoration: "none", borderTop: "1px solid #f2f3ff" }}
              >
                Help signing
              </a>
            </div>
          )}
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <main style={{ flex: 1, padding: 24, overflow: "auto", background: "#525659" }}>
          <iframe
            src={`/api/esign/envelopes/by-token/${token}/pdf#toolbar=0&navpanes=0`}
            style={{ width: "100%", height: "calc(100vh - 120px)", border: 0, background: "#fff", borderRadius: 4 }}
            title={documentName}
          />
        </main>

        <aside style={{
          width: 340,
          background: "#fff",
          borderLeft: "1px solid #e6e6e6",
          padding: 20,
          overflowY: "auto",
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#131b2e", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 12 }}>
            Required Fields
          </h2>

          {signatureBoxes.length === 0 && initialBoxes.length === 0 && dateBoxes.length === 0 && (
            <div style={{ padding: 16, background: "#fff8e1", borderRadius: 4, fontSize: 12, color: "#8a6d00", marginBottom: 16 }}>
              No signature boxes configured. Please contact the sender.
            </div>
          )}

          {signatureBoxes.length > 0 && (
            <Section label={`Signature (${signatureBoxes.length})`}>
              {signatureBoxes.map((b, i) => (
                <FieldCard
                  key={`sig-${i}`}
                  kind="signature"
                  label={b.label ?? `Sign here (page ${b.page})`}
                  filled={signatureDataUrl !== null}
                  previewSrc={signatureDataUrl}
                  onClick={() => openAdopt("signature")}
                />
              ))}
            </Section>
          )}

          {initialBoxes.length > 0 && (
            <Section label={`Initials (${initialBoxes.length})`}>
              {initialBoxes.map((b, i) => (
                <FieldCard
                  key={`init-${i}`}
                  kind="initial"
                  label={b.label ?? `Initial here (page ${b.page})`}
                  filled={(initialDataUrl ?? signatureDataUrl) !== null}
                  previewSrc={initialDataUrl ?? signatureDataUrl}
                  onClick={() => openAdopt("initial")}
                />
              ))}
            </Section>
          )}

          {textBoxes.length > 0 && (
            <Section label={`Fill in (${textBoxes.length})`}>
              {textBoxes.map((b, i) => (
                <div key={`text-${i}`} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#747474", marginBottom: 4 }}>
                    {b.label?.trim() ? b.label : `Field (page ${b.page})`}
                  </div>
                  <input
                    type="text"
                    value={textValues[String(i)] ?? ""}
                    onChange={(e) => setTextValues((d) => ({ ...d, [String(i)]: e.target.value }))}
                    placeholder={b.label?.trim() ? b.label : "Type here"}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13, color: "#131b2e" }}
                  />
                </div>
              ))}
            </Section>
          )}

          {checkboxBoxes.length > 0 && (
            <Section label={`Check (${checkboxBoxes.length})`}>
              {checkboxBoxes.map((b, i) => (
                <label
                  key={`cb-${i}`}
                  style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13, color: "#131b2e", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={checkboxValues[String(i)] ?? false}
                    onChange={(e) => setCheckboxValues((d) => ({ ...d, [String(i)]: e.target.checked }))}
                  />
                  {b.label?.trim() ? b.label : `Checkbox (page ${b.page})`}
                </label>
              ))}
            </Section>
          )}

          {dateBoxes.length > 0 && (
            <Section label={`Date (${dateBoxes.length})`}>
              {dateBoxes.map((b, i) => (
                <div key={`date-${i}`} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#747474", marginBottom: 4 }}>{b.label ?? `Date (page ${b.page})`}</div>
                  <input
                    type="date"
                    value={dateValues[String(i)] ?? todayStr()}
                    onChange={(e) => setDateValues((d) => ({ ...d, [String(i)]: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13, color: "#131b2e" }}
                  />
                </div>
              ))}
            </Section>
          )}

          {error && (
            <div style={{ padding: 10, background: "#fef0ec", borderRadius: 4, fontSize: 12, color: "#942b00", marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ position: "sticky", bottom: 0, background: "#fff", paddingTop: 16, borderTop: "1px solid #f2f3ff", marginTop: 16 }}>
            <button
              onClick={finish}
              disabled={!allBoxesReady || submitting}
              style={{
                width: "100%",
                padding: "12px 24px",
                background: allBoxesReady && !submitting ? "linear-gradient(135deg, #0034e4, #3052ff)" : "#c9c9c9",
                color: "#fff",
                border: 0,
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 700,
                cursor: allBoxesReady && !submitting ? "pointer" : "not-allowed",
              }}
            >
              {submitting ? "Signing..." : "Finish & Sign"}
            </button>
            <p style={{ fontSize: 10, color: "#747474", textAlign: "center", marginTop: 8 }}>
              By clicking Finish & Sign you agree your electronic signature is legally binding under the U.S. ESIGN Act and UETA.
            </p>
          </div>
        </aside>
      </div>

      {adoptOpen && (
        <AdoptModal
          kind={adoptKind}
          fullName={fullName}
          setFullName={setFullName}
          onCancel={() => setAdoptOpen(false)}
          onAdopt={(dataUrl) => {
            if (adoptKind === "signature") {
              setSignatureDataUrl(dataUrl);
              if (!initialDataUrl) setInitialDataUrl(dataUrl);
            } else {
              setInitialDataUrl(dataUrl);
            }
            setAdoptOpen(false);
          }}
        />
      )}

      {declineOpen && (
        <DeclineModal
          reason={declineReason}
          setReason={setDeclineReason}
          onCancel={() => setDeclineOpen(false)}
          onConfirm={decline}
        />
      )}

      <span style={{ display: "none" }}>{envelopeId}</span>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: "#747474", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700, marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function FieldCard({
  kind,
  label,
  filled,
  previewSrc,
  onClick,
}: {
  kind: "signature" | "initial";
  label: string;
  filled: boolean;
  previewSrc: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 10,
        marginBottom: 8,
        border: filled ? "1px solid #1a7d37" : "1.5px dashed #b48c00",
        background: filled ? "#f0faf3" : "#fff8e1",
        borderRadius: 4,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={{ width: 60, height: 30, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt="" style={{ maxWidth: "100%", maxHeight: "100%" }} />
        ) : (
          <span style={{ fontSize: 10, color: "#b48c00", fontWeight: 700 }}>
            {kind === "signature" ? "SIGN" : "INIT"}
          </span>
        )}
      </div>
      <div style={{ flex: 1, fontSize: 12, color: "#131b2e" }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 10, color: filled ? "#1a7d37" : "#b48c00" }}>
          {filled ? "Adopted" : "Click to sign"}
        </div>
      </div>
    </button>
  );
}

function AdoptModal({
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
    const family = TYPE_FONTS.find((f) => f.id === styleId)?.family ?? "cursive";
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,13,30,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 600, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e6e6e6" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#131b2e", margin: 0 }}>
            Adopt your {kind === "signature" ? "signature" : "initials"}
          </h2>
          <p style={{ fontSize: 12, color: "#747474", margin: "4px 0 0" }}>
            This {kind === "signature" ? "signature" : "initial set"} will be applied to every {kind === "signature" ? "signature" : "initial"} field in the document.
          </p>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "#747474", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700, display: "block", marginBottom: 4 }}>
              Full Name
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 14 }}
            />
          </div>

          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e6e6e6", marginBottom: 16 }}>
            {(["type", "draw"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: 0,
                  borderBottom: tab === t ? "2px solid #3052ff" : "2px solid transparent",
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {TYPE_FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStyleId(f.id)}
                    style={{
                      padding: 16,
                      background: "#fff",
                      border: styleId === f.id ? "2px solid #3052ff" : "1px solid #c9c9c9",
                      borderRadius: 4,
                      cursor: "pointer",
                      textAlign: "center",
                      minHeight: 70,
                    }}
                  >
                    <div style={{ fontSize: 10, color: "#747474", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
                      {f.label}
                    </div>
                    <div style={{ fontFamily: f.family, fontSize: kind === "initial" ? 32 : 22, color: "#0a1a3d", fontStyle: "italic" }}>
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
                style={{ width: "100%", height: 180, border: "1px solid #c9c9c9", borderRadius: 4, touchAction: "none", background: "#fff" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button onClick={clearCanvas} style={{ background: "transparent", border: 0, color: "#3052ff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Clear
                </button>
                <span style={{ fontSize: 11, color: "#747474" }}>{hasInk ? "Ready" : "Draw above"}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #e6e6e6", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#444656" }}>
            Cancel
          </button>
          <button
            onClick={adopt}
            disabled={tab === "draw" && !hasInk}
            style={{
              padding: "8px 20px",
              background: (tab === "draw" && !hasInk) ? "#c9c9c9" : "linear-gradient(135deg, #0034e4, #3052ff)",
              color: "#fff",
              border: 0,
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 700,
              cursor: (tab === "draw" && !hasInk) ? "not-allowed" : "pointer",
            }}
          >
            Adopt and Sign
          </button>
        </div>
      </div>
    </div>
  );
}

function DeclineModal({
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,13,30,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 480, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#131b2e", margin: "0 0 8px" }}>Decline to sign</h2>
        <p style={{ fontSize: 13, color: "#444656", margin: "0 0 12px" }}>
          The sender will be notified that you declined this document. Please share a brief reason.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for declining..."
          style={{ width: "100%", minHeight: 100, padding: 10, border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13, color: "#131b2e", resize: "vertical" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} style={{ padding: "8px 16px", background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#444656" }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!reason.trim()}
            style={{ padding: "8px 20px", background: reason.trim() ? "#942b00" : "#c9c9c9", color: "#fff", border: 0, borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: reason.trim() ? "pointer" : "not-allowed" }}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
