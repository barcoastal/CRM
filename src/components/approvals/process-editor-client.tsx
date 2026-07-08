"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "@/components/icons/lucide";
import { CriteriaBuilder, type CriteriaRule } from "./criteria-builder";
import { SubmittersPicker } from "./submitters-picker";

const ENTITY_TYPES = ["Opportunity", "Settlement", "Fee", "Offer", "Lead", "Case"];

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface ProcessForm {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  isActive: boolean;
  entryCriteria: CriteriaRule[];
  initialSubmitters: string[];
}

interface StepForm {
  id: string;
  order: number;
  name: string;
  approverUserIds: string[];
  useSubmitterManager: boolean;
  allowSkip: boolean;
}

export function ProcessEditorClient({
  process,
  steps: initialSteps,
  users,
}: {
  process: ProcessForm;
  steps: StepForm[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProcessForm>(process);
  const [steps, setSteps] = useState<StepForm[]>(initialSteps);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveProcess() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/processes/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          entityType: form.entityType,
          isActive: form.isActive,
          entryCriteria: form.entryCriteria,
          initialSubmitters: form.initialSubmitters,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Save failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function addStep() {
    setBusy(true);
    try {
      const res = await fetch(`/api/approvals/processes/${form.id}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Step ${steps.length + 1}` }),
      });
      if (res.ok) {
        const created = await res.json();
        setSteps([
          ...steps,
          {
            id: created.id,
            order: created.order,
            name: created.name,
            approverUserIds: created.approverUserIds,
            useSubmitterManager: created.useSubmitterManager,
            allowSkip: created.allowSkip,
          },
        ]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function patchStep(stepId: string, patch: Partial<StepForm>) {
    const next = steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s));
    setSteps(next);
    await fetch(`/api/approvals/processes/${form.id}/steps/${stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function deleteStep(stepId: string) {
    if (!window.confirm("Delete this step?")) return;
    const res = await fetch(`/api/approvals/processes/${form.id}/steps/${stepId}`, {
      method: "DELETE",
    });
    if (res.ok) setSteps(steps.filter((s) => s.id !== stepId));
  }

  async function deleteProcess() {
    if (!window.confirm("Delete this process? All requests will be orphaned.")) return;
    const res = await fetch(`/api/approvals/processes/${form.id}`, { method: "DELETE" });
    if (res.ok) router.push("/approvals/processes");
  }

  return (
    <div className="space-y-5">
      <div
        className="bg-white rounded-xl p-6 space-y-5"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-bold text-[#131b2e]">Process Settings</div>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-[#444656]">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-[#c9c9c9] rounded text-[13px] outline-none focus:border-[#3052ff]"
            />
          </Field>
          <Field label="Applies To">
            <select
              value={form.entityType}
              onChange={(e) => setForm({ ...form, entityType: e.target.value })}
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
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-[#c9c9c9] rounded text-[13px] outline-none focus:border-[#3052ff] resize-y"
          />
        </Field>
        <Field label="Entry Criteria" help="A record must match ALL to be eligible.">
          <CriteriaBuilder
            value={form.entryCriteria}
            onChange={(next) => setForm({ ...form, entryCriteria: next })}
          />
        </Field>
        <Field label="Allowed Submitters" help="Empty = anyone can submit.">
          <SubmittersPicker
            users={users}
            value={form.initialSubmitters}
            onChange={(next) => setForm({ ...form, initialSubmitters: next })}
          />
        </Field>

        {error && (
          <div className="text-[12px] text-[#9d1414] bg-[#fde2e2] px-3 py-2 rounded">{error}</div>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={deleteProcess}
            className="inline-flex items-center gap-1 px-3 py-2 rounded text-[12px] font-semibold text-[#9d1414] bg-[#fde2e2]"
          >
            <Trash2 className="size-3" />
            Delete Process
          </button>
          <button
            type="button"
            onClick={saveProcess}
            disabled={busy}
            className="inline-flex items-center px-4 py-2 rounded text-[13px] font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            {busy ? "Saving..." : "Save Process"}
          </button>
        </div>
      </div>

      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div className="px-5 py-4 border-b border-[#f2f3ff] flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-[#131b2e]">Approval Steps</div>
            <div className="text-[12px] text-[#747474]">
              Requests advance through steps in order. Any approver in a step can advance.
            </div>
          </div>
          <button
            type="button"
            onClick={addStep}
            disabled={busy}
            className="inline-flex items-center gap-1 px-3 py-2 rounded text-[13px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
          >
            <Plus className="size-4" />
            Add Step
          </button>
        </div>
        <div className="divide-y divide-[#f2f3ff]">
          {steps.length === 0 && (
            <div className="px-5 py-10 text-center text-[13px] text-[#747474]">
              No steps yet. Add one to get started.
            </div>
          )}
          {steps.map((s, idx) => (
            <StepRow
              key={s.id}
              step={s}
              users={users}
              index={idx}
              onPatch={(patch) => patchStep(s.id, patch)}
              onDelete={() => deleteStep(s.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepRow({
  step,
  users,
  index,
  onPatch,
  onDelete,
}: {
  step: StepForm;
  users: UserOption[];
  index: number;
  onPatch: (patch: Partial<StepForm>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center justify-center size-7 rounded-full text-[12px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          {index + 1}
        </span>
        <input
          value={step.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          className="flex-1 px-3 py-1.5 border border-transparent rounded text-[14px] font-semibold text-[#131b2e] outline-none focus:border-[#3052ff] focus:bg-white"
        />
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 text-[#9d1414] hover:bg-[#fde2e2] rounded"
          title="Delete step"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 pl-10">
        <div>
          <label className="flex items-center gap-2 text-[12px] font-semibold text-[#444656] mb-1.5">
            <input
              type="checkbox"
              checked={step.useSubmitterManager}
              onChange={(e) => onPatch({ useSubmitterManager: e.target.checked })}
            />
            Route to submitter&apos;s manager
          </label>
          {!step.useSubmitterManager && (
            <SubmittersPicker
              users={users}
              value={step.approverUserIds}
              onChange={(next) => onPatch({ approverUserIds: next })}
            />
          )}
          {step.useSubmitterManager && (
            <div className="text-[11px] text-[#747474]">
              The step will route to the manager of whoever submitted the request.
            </div>
          )}
        </div>
        <div className="flex items-start">
          <label className="flex items-center gap-2 text-[12px] font-semibold text-[#444656]">
            <input
              type="checkbox"
              checked={step.allowSkip}
              onChange={(e) => onPatch({ allowSkip: e.target.checked })}
            />
            Allow approvers to skip ahead
          </label>
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
