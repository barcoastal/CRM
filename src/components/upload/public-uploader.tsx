"use client";

import { useRef, useState } from "react";

type Row = { name: string; status: "uploading" | "done" | "error"; error?: string };

export function PublicUploader({ token }: { token: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      const idx = rows.length;
      setRows((r) => [...r, { name: f.name, status: "uploading" }]);
      try {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch(`/api/upload/${token}`, { method: "POST", body: form });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          const msg =
            data.error === "too_large"
              ? "File is over 25 MB"
              : data.error === "expired"
                ? "This link has expired"
                : "Upload failed, please try again";
          markLast(f.name, "error", msg);
        } else {
          markLast(f.name, "done");
        }
      } catch {
        markLast(f.name, "error", "Network error, please try again");
      }
      void idx;
    }
    setBusy(false);
    if (ref.current) ref.current.value = "";
  }

  function markLast(name: string, status: Row["status"], error?: string) {
    setRows((r) => {
      const copy = [...r];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].name === name && copy[i].status === "uploading") {
          copy[i] = { name, status, error };
          break;
        }
      }
      return copy;
    });
  }

  const doneCount = rows.filter((r) => r.status === "done").length;

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
          padding: 36,
          borderRadius: 6,
          textAlign: "center",
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
          disabled={busy}
          style={{
            background: "#0070d2",
            border: "none",
            padding: "10px 22px",
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            cursor: busy ? "wait" : "pointer",
            marginBottom: 10,
          }}
        >
          {busy ? "Uploading..." : "Choose files"}
        </button>
        <div style={{ fontSize: 13, color: "#706e6b" }}>or drop them here (up to 25 MB each)</div>
      </div>

      {doneCount > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            background: "#eaf5ec",
            border: "1px solid #b7e1c2",
            borderRadius: 4,
            fontSize: 13,
            color: "#2e844a",
            fontWeight: 600,
          }}
        >
          {doneCount} file{doneCount === 1 ? "" : "s"} received. Thank you. You can upload more if
          you need to.
        </div>
      )}

      {rows.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
          {rows.map((r, i) => (
            <li
              key={`${r.name}-${i}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 0",
                borderBottom: "1px solid #f3f3f3",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#080707", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.name}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  color:
                    r.status === "done" ? "#2e844a" : r.status === "error" ? "#c23934" : "#706e6b",
                  fontWeight: 600,
                }}
              >
                {r.status === "uploading"
                  ? "Uploading..."
                  : r.status === "done"
                    ? "Done"
                    : r.error ?? "Error"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
