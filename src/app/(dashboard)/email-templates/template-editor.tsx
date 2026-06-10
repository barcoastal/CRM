"use client";

/**
 * Shared client editor for both /email-templates/new and /email-templates/[id].
 *
 * Mode "new" creates the template first (POST /api/email-templates) and
 * redirects to the edit page so the user can immediately upload attachments
 * (which need a templateId to bind to).
 *
 * Mode "edit" supports inline save (PATCH) and an Attachments section with
 * upload (multipart POST) + delete (DELETE) backed by Railway volume storage.
 */
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { RichEditor } from "@/components/email/rich-editor";

interface InitialTemplate {
  name: string;
  developerName: string;
  subject: string;
  bodyHtml: string;
  description: string;
  folder: string;
  isActive: boolean;
}

interface AttachmentRow {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  createdAt: string;
}

interface TemplateEditorProps {
  mode: "new" | "edit";
  templateId?: string;
  initial?: InitialTemplate;
  attachments: AttachmentRow[];
}

const EMPTY: InitialTemplate = {
  name: "",
  developerName: "",
  subject: "",
  bodyHtml: "",
  description: "",
  folder: "General",
  isActive: true,
};

export function TemplateEditor({ mode, templateId, initial, attachments: initialAttachments }: TemplateEditorProps) {
  const router = useRouter();
  const seed = initial ?? EMPTY;
  const [name, setName] = useState(seed.name);
  const [developerName, setDeveloperName] = useState(seed.developerName);
  const [subject, setSubject] = useState(seed.subject);
  const [bodyHtml, setBodyHtml] = useState(seed.bodyHtml);
  const [description, setDescription] = useState(seed.description);
  const [folder, setFolder] = useState(seed.folder);
  const [isActive, setIsActive] = useState(seed.isActive);
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentRow[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!developerName.trim()) {
      toast.error("Developer name is required");
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setBusy(true);
    try {
      if (mode === "new") {
        const res = await fetch("/api/email-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            developerName: developerName.trim(),
            subject: subject.trim(),
            bodyHtml,
            description: description.trim() || null,
            folder: folder.trim() || "General",
            isActive,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!res.ok || !data.id) {
          toast.error(data.error ?? "Failed to create template");
          return;
        }
        toast.success("Template created");
        router.push(`/email-templates/${data.id}`);
        router.refresh();
        return;
      }
      const res = await fetch(`/api/email-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subject: subject.trim(),
          bodyHtml,
          description: description.trim() || null,
          folder: folder.trim() || "General",
          isActive,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Save failed");
        return;
      }
      toast.success("Saved");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [mode, templateId, name, developerName, subject, bodyHtml, description, folder, isActive, router]);

  const onUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (mode === "new" || !templateId) {
        toast.error("Save the template before adding attachments");
        return;
      }
      setUploading(true);
      try {
        const fd = new FormData();
        for (const f of Array.from(files)) {
          fd.append("file", f, f.name);
        }
        const res = await fetch(`/api/email-templates/${templateId}/attachments`, {
          method: "POST",
          body: fd,
        });
        const data = (await res.json().catch(() => ({}))) as {
          items?: AttachmentRow[];
          error?: string;
        };
        if (!res.ok) {
          toast.error(data.error ?? "Upload failed");
          return;
        }
        setAttachments((prev) => [...prev, ...(data.items ?? [])]);
        toast.success(`Uploaded ${data.items?.length ?? 0} file(s)`);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [mode, templateId],
  );

  const onDeleteAttachment = useCallback(
    async (attId: string) => {
      if (!templateId) return;
      if (!confirm("Delete this attachment?")) return;
      const res = await fetch(`/api/email-templates/${templateId}/attachments/${attId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Delete failed");
        return;
      }
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
      toast.success("Deleted");
    },
    [templateId],
  );

  return (
    <div className="space-y-4 rounded-md border border-[#d8dde6] bg-white p-5 text-[13px] text-[#080707]">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Developer Name" required>
          <input
            value={developerName}
            onChange={(e) => setDeveloperName(e.target.value)}
            disabled={mode === "edit"}
            style={{ ...inputStyle, background: mode === "edit" ? "#f4f6f9" : "#fff" }}
            placeholder="A-Z, 0-9, underscores"
          />
        </Field>
        <Field label="Folder">
          <input value={folder} onChange={(e) => setFolder(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Active">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Visible to senders</span>
          </label>
        </Field>
        <Field label="Description" full>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description for template pickers"
            style={inputStyle}
          />
        </Field>
        <Field label="Subject" required full>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <div>
        <div style={labelStyle}>Body</div>
        <RichEditor value={bodyHtml} onChange={setBodyHtml} />
      </div>

      {mode === "edit" && (
        <div>
          <div style={{ ...labelStyle, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Attachments</span>
            <label style={uploadBtn(uploading)}>
              {uploading ? "Uploading..." : "Add files"}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => onUpload(e.target.files)}
                style={{ display: "none" }}
                disabled={uploading}
              />
            </label>
          </div>
          {attachments.length === 0 ? (
            <div
              style={{
                border: "1px dashed #d8dde6",
                borderRadius: 4,
                padding: 16,
                fontSize: 12,
                color: "#706e6b",
                textAlign: "center",
              }}
            >
              No attachments. Files added here will be sent with every email that uses this template.
            </div>
          ) : (
            <div style={{ border: "1px solid #d8dde6", borderRadius: 4, overflow: "hidden" }}>
              {attachments.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderBottom: "1px solid #ecebea",
                    fontSize: 12,
                  }}
                >
                  <a
                    href={`/api/email-templates/${templateId}/attachments/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#0070d2", textDecoration: "none", fontWeight: 600 }}
                  >
                    {a.filename}
                  </a>
                  <span style={{ color: "#706e6b" }}>{formatBytes(a.byteSize)}</span>
                  <span style={{ color: "#706e6b" }}>{a.contentType}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteAttachment(a.id)}
                    style={{
                      marginLeft: "auto",
                      background: "transparent",
                      border: 0,
                      color: "#c23934",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          style={{
            background: "#0070d2",
            color: "#fff",
            padding: "8px 20px",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            border: 0,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Saving..." : mode === "new" ? "Create" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  full,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <div style={labelStyle}>
        {label}
        {required && <span style={{ color: "#c23934", marginLeft: 2 }}>*</span>}
      </div>
      {children}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#3e3e3c",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 8px",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  fontSize: 13,
  outline: "none",
  color: "#080707",
};

function uploadBtn(uploading: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#fff",
    border: "1px solid #d8dde6",
    padding: "5px 12px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    color: "#0070d2",
    cursor: uploading ? "not-allowed" : "pointer",
    opacity: uploading ? 0.6 : 1,
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
