"use client";

import { useEffect, useRef, useState } from "react";
import "superdoc/style.css";

/**
 * In-CRM Word-style editor for a contract template. Opens the stored .docx with
 * SuperDoc, lets the user drop signature/date/name fields inline (they become
 * part of the document text), and saves back to .docx. Fields are inserted as
 * anchor tokens (\s\ \d\ \n\ \i\ \t\) so the packet/send pipeline detects them.
 */
const FIELDS: { token: string; label: string; hint: string }[] = [
  { token: "\\s\\", label: "Signature", hint: "Client signs here" },
  { token: "\\i\\", label: "Initials", hint: "Client initials" },
  { token: "\\d\\", label: "Date", hint: "Date signed" },
  { token: "\\n\\", label: "Full name", hint: "Client's printed name" },
  { token: "\\t\\", label: "Text / title", hint: "Free text (e.g. title)" },
];

type SuperDocInstance = {
  activeEditor?: { commands: { insertContent: (c: string, o?: { contentType?: string }) => void } };
  export: (o: { triggerDownload: boolean; isFinalDoc?: boolean }) => Promise<Blob>;
  destroy?: () => void;
};

export function DocxFieldEditor({ category, label }: { category: string; label: string }) {
  const editorId = `sd-editor-${category}`;
  const toolbarId = `sd-toolbar-${category}`;
  const sdRef = useRef<SuperDocInstance | null>(null);
  const [status, setStatus] = useState("Loading editor…");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const res = await fetch(`/api/contracts/templates/${category}/file`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const file = new File([blob], `${category}.docx`, {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        // Client-only: load SuperDoc JS at runtime (styles imported at top).
        const { SuperDoc } = await import("superdoc");
        if (disposed || !document.getElementById(editorId)) return;

        const sd = new SuperDoc({
          selector: `#${editorId}`,
          toolbar: `#${toolbarId}`,
          documentMode: "editing",
          documents: [{ id: category, type: "docx", data: file }],
          onReady: () => {
            if (disposed) return;
            setReady(true);
            setStatus("Ready. Click in the document, then insert a field.");
          },
        }) as unknown as SuperDocInstance;
        sdRef.current = sd;
      } catch (e) {
        if (!disposed) setStatus(`Error: ${(e as Error).message}`);
      }
    })();
    return () => {
      disposed = true;
      try {
        sdRef.current?.destroy?.();
      } catch {
        // ignore teardown errors
      }
    };
  }, [category, editorId, toolbarId]);

  function insertField(token: string) {
    const editor = sdRef.current?.activeEditor;
    if (!editor) {
      setStatus("Click inside the document first, then insert.");
      return;
    }
    // Space padding so the token stays a standalone word for anchor detection.
    editor.commands.insertContent(` ${token} `, { contentType: "text" });
  }

  async function save() {
    if (!sdRef.current) return;
    setSaving(true);
    setSaved(null);
    try {
      const blob = await sdRef.current.export({ triggerDownload: false, isFinalDoc: false });
      const fd = new FormData();
      fd.append("category", category);
      fd.append("file", new File([blob], `${category}.docx`, { type: blob.type }));
      const res = await fetch("/api/contracts/templates", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setSaved("Saved. Fields are baked into the template.");
    } catch (e) {
      setSaved(`Error saving: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>Edit: {label}</h1>
          <div style={{ fontSize: 12, color: "#706e6b" }}>{status}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/contracts/templates" style={{ fontSize: 13, color: "#0070d2", alignSelf: "center" }}>
            ← Templates
          </a>
          <button
            onClick={save}
            disabled={!ready || saving}
            style={{ background: "#2e844a", color: "#fff", border: 0, padding: "8px 18px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: ready ? 1 : 0.5 }}
          >
            {saving ? "Saving…" : "Save Template"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#706e6b", alignSelf: "center", fontWeight: 600 }}>Insert field:</span>
        {FIELDS.map((f) => (
          <button
            key={f.token}
            onClick={() => insertField(f.token)}
            disabled={!ready}
            title={f.hint}
            style={{ background: "#eef2ff", color: "#3730a3", border: "1px solid #c7d2fe", padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: ready ? "pointer" : "default", opacity: ready ? 1 : 0.5 }}
          >
            + {f.label}
          </button>
        ))}
      </div>

      {saved && (
        <div style={{ fontSize: 13, marginBottom: 8, color: saved.startsWith("Error") ? "#c23934" : "#2e844a", fontWeight: 600 }}>
          {saved}
        </div>
      )}

      <div id={toolbarId} style={{ border: "1px solid #e6e6e6", borderRadius: "4px 4px 0 0", minHeight: 40 }} />
      <div
        id={editorId}
        style={{ border: "1px solid #e6e6e6", borderTop: 0, borderRadius: "0 0 4px 4px", minHeight: 600, background: "#f5f6f8" }}
      />
    </div>
  );
}
