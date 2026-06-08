"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RecordFileAttach } from "./record-file-attach";

interface DocRow {
  id: string;
  title: string;
  latestVersion: { filename: string; contentType: string; byteSize: number; versionNumber: number } | null;
  owner: { id: string; name: string } | null;
  updatedAt: string;
}

interface LinkRow {
  id: string;
  documentId: string;
  document: DocRow;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Lists Content Library documents linked to a record. Lives on Lead/Opp/Account
 * detail pages alongside (not replacing) any existing per-record file UI.
 */
export function RecordFiles({
  entityType,
  entityId,
  title = "Files",
}: {
  entityType: string;
  entityId: string;
  title?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachOpen, setAttachOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ entityType, entityId, take: "50" });
    const res = await fetch(`/api/files/record?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      setRows(json);
    }
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  async function unlink(docId: string) {
    if (!confirm("Unlink this file from this record?")) return;
    await fetch(`/api/files/${docId}/link?entityType=${entityType}&entityId=${entityId}`, {
      method: "DELETE",
    });
    load();
    router.refresh();
  }

  return (
    <section style={{ background: "#fff", border: "1px solid #ecebea", borderRadius: 4, padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "#3e3e3c", textTransform: "uppercase", letterSpacing: 0.4, margin: 0, flex: 1 }}>
          {title} ({rows.length})
        </h2>
        <button
          onClick={() => setAttachOpen(true)}
          style={{ background: "#3052ff", color: "#fff", border: 0, padding: "5px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
        >
          + Attach
        </button>
      </div>
      {loading ? (
        <p style={{ color: "#706e6b", fontSize: 12 }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#706e6b", fontSize: 12 }}>No files linked yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f7f7f7" }}>
              <Link href={`/files/${r.documentId}`} style={{ flex: 1, color: "#3052ff", textDecoration: "none", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.document.title}
              </Link>
              <span style={{ fontSize: 11, color: "#706e6b" }}>
                {r.document.latestVersion ? formatBytes(r.document.latestVersion.byteSize) : ""}
              </span>
              <a href={`/api/files/${r.documentId}/download`} style={{ color: "#3052ff", fontSize: 11 }}>
                Download
              </a>
              <button
                onClick={() => unlink(r.documentId)}
                style={{ background: "transparent", border: 0, color: "#c23934", cursor: "pointer", fontSize: 11 }}
              >
                Unlink
              </button>
            </li>
          ))}
        </ul>
      )}
      <RecordFileAttach
        entityType={entityType}
        entityId={entityId}
        open={attachOpen}
        onClose={() => {
          setAttachOpen(false);
          load();
        }}
      />
    </section>
  );
}
