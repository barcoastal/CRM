"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CriteriaBuilder, type CriteriaRule } from "./criteria-builder";
import { SubmittersPicker } from "./submitters-picker";

const ENTITY_TYPES = ["Opportunity", "Settlement", "Fee", "Offer", "Lead", "Case"];

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export function NewProcessClient({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState("Opportunity");
  const [criteria, setCriteria] = useState<CriteriaRule[]>([]);
  const [submitters, setSubmitters] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/approvals/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          entityType,
          entryCriteria: criteria,
          initialSubmitters: submitters,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      router.push(`/approvals/processes/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            New Approval Process
          </h1>
          <p className="text-[13px] text-[#444656] mt-1">
            Step 1 of 2 — define the process. You can add approval steps on the next page.
          </p>
        </div>
        <Link
          href="/approvals/processes"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
        >
          Cancel
        </Link>
      </div>

      <div
        className="bg-white rounded-xl p-6 space-y-5"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Settlement over $25K"
              className="w-full px-3 py-2 border border-[#c9c9c9] rounded text-[13px] outline-none focus:border-[#3052ff]"
            />
          </Field>
          <Field label="Applies To">
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full px-3 py-2 border border-[#c9c9c9] rounded text-[13px] outline-none focus:border-[#3052ff] bg-white"
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="When does this approval apply?"
            className="w-full px-3 py-2 border border-[#c9c9c9] rounded text-[13px] outline-none focus:border-[#3052ff] resize-y"
          />
        </Field>

        <Field
          label="Entry Criteria"
          help="A record must match ALL criteria to be eligible for this process. Leave empty to allow any record of this type."
        >
          <CriteriaBuilder value={criteria} onChange={setCriteria} />
        </Field>

        <Field
          label="Allowed Submitters"
          help="Empty = anyone can submit. Pick specific users to restrict who can launch this process."
        >
          <SubmittersPicker users={users} value={submitters} onChange={setSubmitters} />
        </Field>

        {error && (
          <div className="text-[12px] text-[#9d1414] bg-[#fde2e2] px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link
            href="/approvals/processes"
            className="inline-flex items-center px-4 py-2 rounded text-[13px] font-semibold text-[#444656] bg-[#f2f3ff]"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            {busy ? "Saving..." : "Save and add steps"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[12px] font-semibold text-[#444656] mb-1.5">{label}</div>
      {children}
      {help && <div className="text-[11px] text-[#747474] mt-1">{help}</div>}
    </div>
  );
}
