"use client";

import { useState } from "react";

/**
 * Contract merge tester. Upload a Word (.docx) template that uses {{tokens}} and
 * {{#Schedule}}…{{/Schedule}} / {{#Creditors}}…{{/Creditors}} loops, enter a deal's
 * Opportunity ID, and preview the filled PDF.
 */
export default function ContractPreviewPage() {
  const [file, setFile] = useState<File | null>(null);
  const [oppId, setOppId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  async function run() {
    if (!file || !oppId) return;
    setBusy(true);
    setErr(null);
    setPdfUrl(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("opportunityId", oppId.trim());
      const res = await fetch("/api/contracts/preview", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Contract Merge Preview</h1>
      <p style={{ color: "#706e6b", fontSize: 13, marginBottom: 16 }}>
        Upload a Word (.docx) template using <code>{"{{ClientName}}"}</code> tokens and{" "}
        <code>{"{{#Schedule}}…{{/Schedule}}"}</code> / <code>{"{{#Creditors}}…{{/Creditors}}"}</code> loops, then
        preview it filled with a deal&apos;s data.
      </p>

      <div style={{ display: "grid", gap: 12, maxWidth: 480 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Template (.docx)
          <input
            type="file"
            accept=".docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ display: "block", marginTop: 4, fontSize: 13 }}
          />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Opportunity ID
          <input
            value={oppId}
            onChange={(e) => setOppId(e.target.value)}
            placeholder="e.g. clxxxx…"
            style={{ display: "block", marginTop: 4, width: "100%", height: 32, padding: "0 8px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13 }}
          />
        </label>
        <button
          onClick={run}
          disabled={!file || !oppId || busy}
          style={{ justifySelf: "start", background: "#0070d2", color: "#fff", border: 0, padding: "8px 18px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: !file || !oppId ? 0.5 : 1 }}
        >
          {busy ? "Generating…" : "Generate Preview"}
        </button>
      </div>

      {err && <div style={{ marginTop: 16, color: "#c23934", fontSize: 13 }}>Error: {err}</div>}
      {pdfUrl && (
        <div style={{ marginTop: 16 }}>
          <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ color: "#0070d2", fontSize: 13, fontWeight: 600 }}>
            Open filled PDF ↗
          </a>
          <iframe src={pdfUrl} style={{ display: "block", marginTop: 8, width: "100%", height: 700, border: "1px solid #d8dde6", borderRadius: 4 }} />
        </div>
      )}
    </div>
  );
}
