"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DocItem = {
  id: string;
  name: string;
  type: string;
  fileSize: number | null;
  createdAt: string;
  uploadedBy: { name: string } | null;
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

export function DocumentsUpload({ leadId, items }: { leadId: string; items: DocItem[] }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f);
        form.append("type", "OTHER");
        await fetch(`/api/leads/${leadId}/documents`, { method: "POST", body: form });
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
          border: `2px dashed ${hover ? "#0070d2" : "#d8dde6"}`,
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
            border: "1px solid #d8dde6",
            padding: "6px 16px",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            color: "#0070d2",
            cursor: uploading ? "wait" : "pointer",
            marginBottom: 8,
          }}
        >
          {uploading ? "Uploading…" : "Upload Files"}
        </button>
        <div style={{ fontSize: 13, color: "#706e6b" }}>Or drop files</div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 16, fontSize: 13, color: "#706e6b" }}>
          No files uploaded yet.
        </div>
      ) : (
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #d8dde6", background: "#fafaf9" }}>
              <th style={th}>Name</th>
              <th style={th}>Type</th>
              <th style={th}>Size</th>
              <th style={th}>Uploaded By</th>
              <th style={th}>Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={td}>
                  <a href={`/api/leads/${leadId}/documents/${d.id}`} style={{ color: "#0070d2" }}>
                    {d.name}
                  </a>
                </td>
                <td style={td}>{d.type}</td>
                <td style={td}>{d.fileSize ? formatBytes(d.fileSize) : "—"}</td>
                <td style={td}>{d.uploadedBy?.name ?? "—"}</td>
                <td style={td}>{new Date(d.createdAt).toLocaleString()}</td>
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
  color: "#3e3e3c",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#080707",
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
