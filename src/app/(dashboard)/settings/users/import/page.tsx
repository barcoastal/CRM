"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function UserImportPage() {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    invalid: number;
    errors: string[];
  } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    toast.success(`Loaded ${file.name} (${text.split(/\r?\n/).length - 1} rows)`);
  }

  async function runImport() {
    if (!csv.trim()) {
      toast.error("Paste a CSV or pick a file first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/import-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(data);
        toast.success(`Imported: ${data.created} new, ${data.updated} updated, ${data.invalid} failed`);
      } else {
        toast.error(data.error ?? "Import failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Import Users from Salesforce</h1>
      <p style={{ color: "#747474", fontSize: 13, marginBottom: 16 }}>
        Export users from Salesforce (Setup → Users → Export to CSV) and upload here.
      </p>

      <div style={{ background: "#f3f3f3", border: "1px solid #c9c9c9", borderRadius: 4, padding: 12, marginBottom: 16, fontSize: 12 }}>
        <strong>CSV columns (any of these, case-insensitive):</strong>
        <ul style={{ marginTop: 6, paddingLeft: 20 }}>
          <li><code>Email</code> or <code>Username</code> (required)</li>
          <li><code>Name</code> OR <code>First Name</code> + <code>Last Name</code> (required)</li>
          <li><code>Profile</code> — creates the profile if it doesn't exist</li>
          <li><code>Permission Sets</code> — comma-separated, each created on demand</li>
          <li><code>Manager</code> — email of the manager (wired in a second pass after all users exist)</li>
          <li><code>Title</code>, <code>Role</code>, <code>Active</code></li>
        </ul>
        <p style={{ marginTop: 8, color: "#747474" }}>
          All imported users get the default password <code>password123</code> (we&apos;ll require reset on first login once that flow ships).
        </p>
      </div>

      <label style={{ display: "block", fontSize: 11, color: "#747474", marginBottom: 4 }}>Upload CSV file</label>
      <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ marginBottom: 12 }} />

      <label style={{ display: "block", fontSize: 11, color: "#747474", marginBottom: 4 }}>Or paste CSV here</label>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={12}
        placeholder="Name,Email,Profile,Active&#10;Bar Elezra,bar@coastaldebt.com,Admin,true&#10;..."
        style={{ width: "100%", padding: 8, border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 12, fontFamily: "ui-monospace, monospace", marginBottom: 12 }}
      />

      <button
        onClick={runImport}
        disabled={busy}
        style={{ background: "#0176d3", color: "#fff", padding: "8px 24px", borderRadius: 4, fontWeight: 600, border: 0, cursor: busy ? "wait" : "pointer" }}
      >
        {busy ? "Importing…" : "Import Users"}
      </button>

      {result && (
        <div style={{ marginTop: 24, padding: 16, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Import Result</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
            <Stat label="Created" value={result.created} tone="#04844b" />
            <Stat label="Updated" value={result.updated} tone="#0176d3" />
            <Stat label="Skipped" value={result.skipped} tone="#747474" />
            <Stat label="Failed" value={result.invalid} tone="#c23934" />
          </div>
          {result.errors.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, color: "#c23934" }}>{result.errors.length} errors</summary>
              <pre style={{ marginTop: 8, fontSize: 11, color: "#c23934", maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap" }}>
                {result.errors.join("\n")}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#747474", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: tone }}>{value}</div>
    </div>
  );
}
