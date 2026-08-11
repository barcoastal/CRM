"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ContractAnalysisButton } from "@/components/documents/contract-analysis-button";

type DocItem = {
  id: string;
  name: string;
  type: string;
  fileSize: number | null;
  createdAt: string;
  uploadedBy: { name: string } | null;
  hasAnalysis?: boolean;
};

const DOC_TYPES = [
  "OTHER",
  "ENGAGEMENT_AGREEMENT",
  "HARDSHIP_LETTER",
  "AUTHORIZATION",
  "SETTLEMENT_OFFER",
  "BANK_STATEMENT",
  "TAX_RETURN",
];

export function DocumentsUpload({
  leadId,
  endpoint,
  items,
}: {
  leadId?: string;
  endpoint?: string;
  items: DocItem[];
}) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const baseUrl = endpoint ?? `/api/leads/${leadId}/documents`;

  async function remove(doc: DocItem) {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    try {
      const res = await fetch(`${baseUrl}/${doc.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else alert("Could not delete the file. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f);
        form.append("type", "OTHER");
        await fetch(baseUrl, { method: "POST", body: form });
      }
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHover(false);
          upload(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${hover ? "#0176d3" : "#c9c9c9"}`,
          background: hover ? "#eef4fb" : "#fafaf9",
          padding: 32,
          borderRadius: 4,
          textAlign: "center",
          marginBottom: 16,
        }}
      >
        <input
          ref={ref}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => upload(e.target.files)}
        />
        <button
          onClick={() => ref.current?.click()}
          disabled={uploading}
          style={{
            background: "#fff",
            border: "1px solid #c9c9c9",
            padding: "6px 16px",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            color: "#0176d3",
            cursor: uploading ? "wait" : "pointer",
            marginBottom: 8,
          }}
        >
          {uploading ? "Uploading…" : "Upload Files"}
        </button>
        <div style={{ fontSize: 13, color: "#747474" }}>Or drop files</div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 16, fontSize: 13, color: "#747474" }}>
          No files uploaded yet.
        </div>
      ) : (
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #c9c9c9", background: "#fafaf9" }}>
              <th style={th}>Name</th>
              <th style={th}>Type</th>
              <th style={th}>Size</th>
              <th style={th}>Uploaded By</th>
              <th style={th}>Uploaded</th>
              <th style={{ ...th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={td}>
                  <a
                    href={`${baseUrl}/${d.id}?view=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#0176d3" }}
                  >
                    {d.name}
                  </a>
                </td>
                <td style={td}>{d.type}</td>
                <td style={td}>{d.fileSize ? formatBytes(d.fileSize) : "-"}</td>
                <td style={td}>{d.uploadedBy?.name ?? "-"}</td>
                <td style={td}>{new Date(d.createdAt).toLocaleString()}</td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  {/[.](pdf|png|jpe?g|webp)$/i.test(d.name) && (
                    <span style={{ marginRight: 12, display: "inline-block" }}>
                      <ContractAnalysisButton documentId={d.id} documentName={d.name} hasAnalysis={!!d.hasAnalysis} />
                    </span>
                  )}
                  <a
                    href={`${baseUrl}/${d.id}?view=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={actionLink}
                  >
                    View
                  </a>
                  <a href={`${baseUrl}/${d.id}`} style={actionLink}>
                    Download
                  </a>
                  <button
                    onClick={() => remove(d)}
                    disabled={deletingId === d.id}
                    style={{ ...actionLink, ...actionBtn, color: "#c23934", cursor: deletingId === d.id ? "wait" : "pointer" }}
                  >
                    {deletingId === d.id ? "Deleting…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 12,
  color: "#444444",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#181818",
};

const actionLink: React.CSSProperties = {
  color: "#0176d3",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  marginLeft: 14,
};

const actionBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
