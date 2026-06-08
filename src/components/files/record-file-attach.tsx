"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadButton } from "./upload-button";

interface DocLite {
  id: string;
  title: string;
  latestVersion: { filename: string; contentType: string; byteSize: number } | null;
}

interface Props {
  entityType: string;
  entityId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Modal picker for adding files to a record. Two tabs:
 *   - Upload New: upload + auto-link to this record
 *   - From Library: paginated search + link existing ContentDocument
 */
export function RecordFileAttach({ entityType, entityId, open, onClose }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"upload" | "library">("upload");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<DocLite[]>([]);
  const [linked, setLinked] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || tab !== "library") return;
    let cancelled = false;
    (async () => {
      const url = new URL("/api/files", window.location.origin);
      url.searchParams.set("take", "30");
      if (q) url.searchParams.set("q", q);
      const res = await fetch(url.toString());
      if (!res.ok || cancelled) return;
      const json = await res.json();
      setResults(json.rows ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, q]);

  async function linkDoc(docId: string) {
    setBusyId(docId);
    try {
      const res = await fetch(`/api/files/${docId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId }),
      });
      if (res.ok) {
        setLinked((m) => ({ ...m, [docId]: true }));
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleUploaded(doc: { id: string; title: string }) {
    // Auto-link the freshly uploaded document.
    await fetch(`/api/files/${doc.id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityId }),
    });
    router.refresh();
    onClose();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 4, width: "min(640px, 100%)", margin: 16, maxHeight: "85vh", display: "flex", flexDirection: "column" }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #d8dde6", display: "flex", alignItems: "center" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#080707", flex: 1, margin: 0 }}>
            Attach File
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: 0, fontSize: 20, cursor: "pointer", color: "#706e6b" }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #ecebea" }}>
          <button
            onClick={() => setTab("upload")}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "transparent",
              border: 0,
              borderBottom: tab === "upload" ? "2px solid #3052ff" : "2px solid transparent",
              color: tab === "upload" ? "#3052ff" : "#3e3e3c",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Upload New
          </button>
          <button
            onClick={() => setTab("library")}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "transparent",
              border: 0,
              borderBottom: tab === "library" ? "2px solid #3052ff" : "2px solid transparent",
              color: tab === "library" ? "#3052ff" : "#3e3e3c",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            From Library
          </button>
        </div>

        <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
          {tab === "upload" ? (
            <div>
              <p style={{ fontSize: 13, color: "#3e3e3c", marginTop: 0 }}>
                Upload a file. It will be added to the central library and linked to this record.
              </p>
              <UploadButton
                buttonLabel="Choose file"
                refreshOnSuccess={false}
                onUploaded={handleUploaded}
              />
            </div>
          ) : (
            <div>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the library..."
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #d8dde6", borderRadius: 4, fontSize: 13, marginBottom: 12 }}
              />
              {results.length === 0 ? (
                <p style={{ color: "#706e6b", fontSize: 13 }}>No files match.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {results.map((d) => (
                    <li
                      key={d.id}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f7f7f7" }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#080707", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.title}
                        </div>
                        <div style={{ fontSize: 11, color: "#706e6b" }}>
                          {d.latestVersion?.filename}
                        </div>
                      </div>
                      <button
                        onClick={() => linkDoc(d.id)}
                        disabled={busyId === d.id || linked[d.id]}
                        style={{
                          background: linked[d.id] ? "#04844b" : "#3052ff",
                          color: "#fff",
                          border: 0,
                          padding: "4px 10px",
                          borderRadius: 4,
                          cursor: linked[d.id] ? "default" : "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {linked[d.id] ? "Linked" : busyId === d.id ? "..." : "Link"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
