"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "@/components/icons/lucide";
import { CRM_LEAD_FIELDS } from "../../lead-fields";

type Option = { id: string; name: string | null; email?: string };

type Props = {
  users: Option[];
  queues: { id: string; name: string }[];
};

type MapRow = { src: string; dst: string };

export function NewSourceForm({ users, queues }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [defaultOwnerId, setDefaultOwnerId] = useState("");
  const [defaultQueueId, setDefaultQueueId] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [dedupeBy, setDedupeBy] = useState<"none" | "email" | "phone">("email");
  const [requiredFields, setRequiredFields] = useState<string[]>(["email"]);
  const [mapping, setMapping] = useState<MapRow[]>([
    { src: "first_name", dst: "firstName" },
    { src: "last_name", dst: "lastName" },
    { src: "email", dst: "email" },
    { src: "phone", dst: "phone" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setMapping((m) => [...m, { src: "", dst: "" }]);
  }
  function updateRow(i: number, patch: Partial<MapRow>) {
    setMapping((m) => m.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    setMapping((m) => m.filter((_, idx) => idx !== i));
  }
  function toggleRequired(field: string) {
    setRequiredFields((r) =>
      r.includes(field) ? r.filter((f) => f !== field) : [...r, field],
    );
  }

  async function submit() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    const fieldMapping: Record<string, string> = {};
    for (const r of mapping) {
      if (r.src.trim() && r.dst.trim()) fieldMapping[r.src.trim()] = r.dst.trim();
    }
    const res = await fetch("/api/marketing/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        slug: slug.trim() || undefined,
        isActive,
        defaultOwnerId: defaultOwnerId || null,
        defaultQueueId: defaultQueueId || null,
        leadSource: leadSource.trim() || null,
        dedupeBy: dedupeBy === "none" ? null : dedupeBy,
        requiredFields,
        fieldMapping,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create source");
      return;
    }
    const created = await res.json();
    router.push(`/marketing/sources/${created.id}`);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl p-6 space-y-5" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
      {error && (
        <div className="p-3 rounded text-[13px] bg-[rgba(148,43,0,0.08)] text-[#942b00]">{error}</div>
      )}

      <Row label="Name" required>
        <input
          className="ms-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (!slug && name) setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
          }}
          placeholder="Facebook Lead Gen"
        />
      </Row>

      <Row label="Slug" hint="Used in the webhook URL. Auto-generated from Name.">
        <input
          className="ms-input font-mono text-[12px]"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="facebook-lead-gen"
        />
      </Row>

      <Row label="Status">
        <label className="inline-flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
      </Row>

      <Row label="Default Owner" hint="Lead will be assigned to this user.">
        <select className="ms-input" value={defaultOwnerId} onChange={(e) => setDefaultOwnerId(e.target.value)}>
          <option value="">No default owner</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Default Queue" hint="If set, lead joins this routing queue.">
        <select className="ms-input" value={defaultQueueId} onChange={(e) => setDefaultQueueId(e.target.value)}>
          <option value="">No queue</option>
          {queues.map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Lead Source" hint="Value written to Lead.leadSource. Defaults to source name.">
        <input
          className="ms-input"
          value={leadSource}
          onChange={(e) => setLeadSource(e.target.value)}
          placeholder="Facebook"
        />
      </Row>

      <Row label="Deduplicate By">
        <div className="flex gap-4 text-[13px]">
          {(["none", "email", "phone"] as const).map((v) => (
            <label key={v} className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="dedupeBy"
                value={v}
                checked={dedupeBy === v}
                onChange={() => setDedupeBy(v)}
              />
              {v === "none" ? "Allow duplicates" : `By ${v}`}
            </label>
          ))}
        </div>
      </Row>

      <Row label="Required Fields" hint="Inbound payload must contain these. 400 otherwise.">
        <div className="flex flex-wrap gap-2">
          {CRM_LEAD_FIELDS.map((f) => {
            const on = requiredFields.includes(f);
            return (
              <button
                type="button"
                key={f}
                onClick={() => toggleRequired(f)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                  on
                    ? "bg-[#3052ff] text-white border-[#3052ff]"
                    : "bg-white text-[#444656] border-[#c9c9c9]"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </Row>

      <Row label="Field Mapping" hint="Left: incoming field name. Right: CRM Lead field.">
        <div className="space-y-2">
          {mapping.map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                className="ms-input flex-1 font-mono text-[12px]"
                placeholder="source_field"
                value={r.src}
                onChange={(e) => updateRow(i, { src: e.target.value })}
              />
              <span className="text-[#747474] text-[11px]">→</span>
              <select
                className="ms-input flex-1"
                value={r.dst}
                onChange={(e) => updateRow(i, { dst: e.target.value })}
              >
                <option value="">Choose field...</option>
                {CRM_LEAD_FIELDS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="p-1.5 text-[#942b00] hover:bg-[rgba(148,43,0,0.08)] rounded"
                aria-label="Remove row"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold text-white bg-[#3052ff] border border-[#3052ff]"
          >
            <Plus className="size-3.5" />
            Add Field
          </button>
        </div>
      </Row>

      <div className="flex justify-end gap-2 pt-3 border-t border-[#f2f3ff]">
        <button
          type="button"
          onClick={() => router.push("/marketing/sources")}
          className="px-4 py-2 rounded text-[13px] font-semibold text-[#444656] bg-white border border-[#c9c9c9]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="px-5 py-2 rounded text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          {submitting ? "Creating..." : "Create Source"}
        </button>
      </div>

      <style jsx>{`
        :global(.ms-input) {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #c9c9c9;
          border-radius: 4px;
          font-size: 13px;
          color: #131b2e;
          background: white;
        }
        :global(.ms-input:focus) {
          outline: none;
          border-color: #3052ff;
          box-shadow: 0 0 0 3px rgba(48, 82, 255, 0.12);
        }
      `}</style>
    </div>
  );
}

function Row({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 items-start">
      <div className="pt-2">
        <div className="text-[12px] font-semibold text-[#131b2e]">
          {label}
          {required && <span className="text-[#942b00] ml-1">*</span>}
        </div>
        {hint && <div className="text-[11px] text-[#747474] mt-0.5">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}
