"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload } from "@/components/icons/lucide";
import { RECORD_TYPES } from "@/lib/esign/merge-paths";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function NewTemplateForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [recordType, setRecordType] = useState<string>("CONTRACT");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Please choose a PDF or Word document.");
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", name.trim());
      fd.append("recordType", recordType);
      fd.append("description", description.trim());

      const res = await fetch("/api/esign/templates", { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
        const base = j.error ?? `Upload failed (${res.status})`;
        throw new Error(j.details ? `${base} — ${j.details}` : base);
      }
      const tpl = (await res.json()) as { id: string };
      router.push(`/templates/esign/${tpl.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-xl p-6 space-y-5"
      style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
    >
      <div>
        <label className="block text-[12px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-1.5">
          Document (PDF or Word)
        </label>
        <div className="flex items-center gap-3">
          <label
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[#d8dde6] text-[13px] font-semibold text-[#131b2e] cursor-pointer hover:bg-[#f2f3ff]"
          >
            <Upload className="size-4" />
            Choose file
            <input
              type="file"
              accept="application/pdf,.pdf,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {file ? (
            <span className="text-[13px] text-[#444656]">
              <span className="font-semibold text-[#131b2e]">{file.name}</span>{" "}
              <span className="text-[#706e6b]">({fmtBytes(file.size)})</span>
            </span>
          ) : (
            <span className="text-[12px] text-[#706e6b]">No file selected.</span>
          )}
        </div>
        <p className="text-[12px] text-[#706e6b] mt-1.5">
          Accepts PDF or Word (.docx, .doc). Word files are converted to PDF on upload.
        </p>
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-1.5">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Engagement Agreement"
          className="w-full px-3 py-2 rounded border border-[#d8dde6] text-[13px] outline-none focus:border-[#3052ff]"
        />
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-1.5">
          Record Type
        </label>
        <select
          value={recordType}
          onChange={(e) => setRecordType(e.target.value)}
          className="w-full px-3 py-2 rounded border border-[#d8dde6] text-[13px] bg-white outline-none focus:border-[#3052ff]"
        >
          {RECORD_TYPES.map((rt) => (
            <option key={rt} value={rt}>
              {rt}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[12px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Optional: when to use this template, who signs it, etc."
          className="w-full px-3 py-2 rounded border border-[#d8dde6] text-[13px] outline-none focus:border-[#3052ff]"
        />
      </div>

      {error ? (
        <div className="text-[12px] text-[#c23934] bg-[#fdecea] border border-[#f5c6c0] rounded px-3 py-2">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded text-white text-[13px] font-semibold disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          {submitting ? "Uploading..." : "Create Template"}
        </button>
        <button
          type="button"
          onClick={() => history.back()}
          className="px-4 py-2.5 rounded text-[13px] font-semibold text-[#444656] border border-[#d8dde6] hover:bg-[#f2f3ff]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
