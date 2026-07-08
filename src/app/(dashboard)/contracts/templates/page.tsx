"use client";

import { useEffect, useState } from "react";

/**
 * Contract template manager. Upload one Word (.docx) template per category.
 * COASTAL is always in the packet; the processor (SAS/RAM) and legal
 * (Citadel/Victory) templates are picked per deal by the routing rules.
 */
type Row = { category: string; label: string; originalName: string | null; uploadedAt: string | null };

export default function ContractTemplatesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/contracts/templates");
    const j = await res.json();
    setRows(j.templates ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function upload(category: string, file: File) {
    setBusy(category);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("category", category);
      fd.append("file", file);
      const res = await fetch("/api/contracts/templates", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setRows(j.templates ?? []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Contract Templates</h1>
      <p style={{ color: "#747474", fontSize: 13, marginBottom: 16 }}>
        Upload each agreement as a Word <code>.docx</code> using <code>{"{{ClientName}}"}</code> tokens and{" "}
        <code>{"{{#Schedule}}…{{/Schedule}}"}</code> / <code>{"{{#Creditors}}…{{/Creditors}}"}</code> loops. Coastal is
        always included; the processor and legal plan are chosen per deal.
      </p>

      {err && <div style={{ marginBottom: 12, color: "#c23934", fontSize: 13 }}>Error: {err}</div>}

      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <div
            key={r.category}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              border: "1px solid #c9c9c9",
              borderRadius: 6,
              padding: "12px 16px",
              background: r.originalName ? "#f3faf5" : "#fff",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: "#747474", marginTop: 2 }}>
                {r.originalName ? (
                  <>
                    ✓ {r.originalName}
                    {r.uploadedAt ? ` · ${new Date(r.uploadedAt).toLocaleString()}` : ""}
                  </>
                ) : (
                  "Not uploaded"
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, whiteSpace: "nowrap" }}>
              {r.originalName && (
                <a href={`/contracts/templates/${r.category}/edit`} style={{ fontSize: 13, fontWeight: 600, color: "#2e844a" }}>
                  Edit fields
                </a>
              )}
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0176d3",
                  cursor: busy === r.category ? "wait" : "pointer",
                }}
              >
                {busy === r.category ? "Uploading…" : r.originalName ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept=".docx"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(r.category, f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
