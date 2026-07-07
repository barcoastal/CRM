"use client";

import { useEffect, useRef, useState } from "react";
import "superdoc/style.css";
import { SCALAR_FIELDS, TABLE_FIELDS, tableFieldHtml } from "@/lib/contracts/fields";

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

// Group the scalar CRM fields for the palette.
const SCALAR_GROUPS = SCALAR_FIELDS.reduce<Record<string, typeof SCALAR_FIELDS>>((acc, f) => {
  (acc[f.group] ??= []).push(f);
  return acc;
}, {});

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

  /** Insert a CRM merge token, e.g. {{ClientName}}, at the cursor. */
  function insertCrmField(token: string) {
    const editor = sdRef.current?.activeEditor;
    if (!editor) {
      setStatus("Click inside the document first, then insert.");
      return;
    }
    editor.commands.insertContent(`{{${token}}}`, { contentType: "text" });
  }

  /** Insert a repeating CRM table (creditors / payment schedule / ACH). */
  function insertCrmTable(tableToken: string) {
    const editor = sdRef.current?.activeEditor;
    if (!editor) {
      setStatus("Click inside the document first, then insert.");
      return;
    }
    const field = TABLE_FIELDS.find((t) => t.token === tableToken);
    if (!field) return;
    editor.commands.insertContent(tableFieldHtml(field), { contentType: "html" });
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

      {saved && (
        <div style={{ fontSize: 13, marginBottom: 8, color: saved.startsWith("Error") ? "#c23934" : "#2e844a", fontWeight: 600 }}>
          {saved}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div id={toolbarId} style={{ border: "1px solid #e6e6e6", borderRadius: "4px 4px 0 0", minHeight: 40 }} />
          <div
            id={editorId}
            style={{ border: "1px solid #e6e6e6", borderTop: 0, borderRadius: "0 0 4px 4px", minHeight: 600, background: "#f5f6f8" }}
          />
        </div>

        <aside style={{ width: 260, flexShrink: 0, border: "1px solid #e6e6e6", borderRadius: 6, padding: 12, maxHeight: 700, overflowY: "auto", position: "sticky", top: 12 }}>
          <div style={{ fontSize: 11, color: "#706e6b", marginBottom: 10 }}>
            Click in the document, then click a field to drop it in. CRM fields auto-fill from the deal when you send.
          </div>

          <PaletteGroup title="Signature fields" color="#3730a3" bg="#eef2ff" border="#c7d2fe">
            {FIELDS.map((f) => (
              <Chip key={f.token} disabled={!ready} title={f.hint} color="#3730a3" bg="#eef2ff" border="#c7d2fe" onClick={() => insertField(f.token)}>
                + {f.label}
              </Chip>
            ))}
          </PaletteGroup>

          {Object.entries(SCALAR_GROUPS).map(([group, fields]) => (
            <PaletteGroup key={group} title={`CRM: ${group}`} color="#0f5132" bg="#e7f5ec" border="#a3d9b8">
              {fields.map((f) => (
                <Chip key={f.token} disabled={!ready} title={`{{${f.token}}}`} color="#0f5132" bg="#e7f5ec" border="#a3d9b8" onClick={() => insertCrmField(f.token)}>
                  + {f.label}
                </Chip>
              ))}
            </PaletteGroup>
          ))}

          <PaletteGroup title="CRM tables" color="#8a4b00" bg="#fdf0e3" border="#f2c79a">
            {TABLE_FIELDS.map((t) => (
              <Chip key={t.token} disabled={!ready} title={`{{#${t.token}}}…{{/${t.token}}}`} color="#8a4b00" bg="#fdf0e3" border="#f2c79a" onClick={() => insertCrmTable(t.token)}>
                + {t.label}
              </Chip>
            ))}
          </PaletteGroup>
        </aside>
      </div>
    </div>
  );
}

function PaletteGroup({
  title,
  children,
}: {
  title: string;
  color: string;
  bg: string;
  border: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "#706e6b", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>
    </div>
  );
}

function Chip({
  children,
  onClick,
  disabled,
  title,
  color,
  bg,
  border,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  title: string;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ background: bg, color, border: `1px solid ${border}`, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  );
}
