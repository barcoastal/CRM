"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  folderId?: string | null;
  endpoint?: string;
  buttonLabel?: string;
  onUploaded?: (doc: { id: string; title: string }) => void;
  /** When true (default), refreshes the current route after a successful upload. */
  refreshOnSuccess?: boolean;
  /** Override the form field name (useful for new-version endpoint). */
  fieldName?: string;
}

export function UploadButton({
  folderId = null,
  endpoint = "/api/files",
  buttonLabel = "Upload",
  onUploaded,
  refreshOnSuccess = true,
  fieldName = "file",
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return;
    const file = files[0];
    if (file.size > 50 * 1024 * 1024) {
      setErr("File exceeds 50MB limit");
      return;
    }
    setErr(null);
    setBusy(true);
    setProgress(`Uploading ${file.name}...`);
    try {
      const fd = new FormData();
      fd.set(fieldName, file);
      fd.set("title", file.name);
      if (folderId) fd.set("folderId", folderId);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`);
      onUploaded?.(json);
      if (refreshOnSuccess) router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        style={{
          background: "#3052ff",
          color: "#fff",
          border: 0,
          padding: "6px 14px",
          borderRadius: 4,
          cursor: busy ? "wait" : "pointer",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {busy ? (progress ?? "Uploading...") : `+ ${buttonLabel}`}
      </button>
      <input
        type="file"
        ref={fileRef}
        style={{ display: "none" }}
        onChange={(e) => handleUpload(e.target.files)}
      />
      {err && <span style={{ color: "#c23934", fontSize: 11 }}>{err}</span>}
    </div>
  );
}
