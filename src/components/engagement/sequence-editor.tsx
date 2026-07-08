"use client";

/**
 * Sequence editor + dashboard.
 *
 * Top: header card (description, status badges, Activate/Pause + Run Now buttons).
 * Stats row: enrolled / active / paused / completed / exited counts.
 * Tabs:
 *   - Steps: ordered cards with inspector per kind; add / reorder / delete.
 *   - Settings: name, description, allowReEnroll, entry criteria builder.
 *   - Enrollments: paginated table with status filter + manual enroll.
 *   - History: derived from enrollment history JSON (rolled up).
 *
 * Brand: Manrope, white cards, #3052ff primary. NOT SLDS.
 */

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ChevronUpIcon,
  ChevronDownIcon,
  Play,
  Pause,
  Activity,
  X,
} from "@/components/icons/lucide";
import {
  STEP_KINDS,
  STEP_KIND_LABELS,
  STEP_KIND_DESCRIPTIONS,
  type StepKind,
} from "@/lib/engagement/steps";

type Cond = { kind: "and" | "or"; conditions: Array<{ field: string; operator: string; value?: unknown }> };
type Step = { id: string; order: number; kind: string; label: string; config: Record<string, unknown> };
type Seq = {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  isActive: boolean;
  allowReEnroll: boolean;
  maxEnrollsPerTick: number;
  entryCriteria: Cond;
  totalEnrolled: number;
  totalCompleted: number;
  totalExited: number;
  steps: Step[];
};

const LEAD_FIELDS = [
  { key: "businessName", label: "Business Name" },
  { key: "contactName", label: "Contact Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "industry", label: "Industry" },
  { key: "state", label: "State" },
  { key: "score", label: "Score" },
  { key: "totalDebtEst", label: "Total Debt Est." },
  { key: "annualRevenue", label: "Annual Revenue" },
  { key: "numberOfLenders", label: "# of Lenders" },
  { key: "lastDisposition", label: "Last Disposition" },
  { key: "recordType", label: "Record Type" },
  { key: "createdAt", label: "Created At" },
];

const OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "notEquals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "startsWith", label: "starts with" },
  { value: "endsWith", label: "ends with" },
  { value: "gt", label: "greater than" },
  { value: "gte", label: "greater than or equal" },
  { value: "lt", label: "less than" },
  { value: "lte", label: "less than or equal" },
  { value: "isNull", label: "is empty" },
  { value: "isNotNull", label: "is not empty" },
  { value: "in", label: "is one of" },
  { value: "notIn", label: "is not one of" },
];

export function EngagementEditor(props: {
  seq: Seq;
  stats: { active: number; paused: number; completed: number; exited: number };
  templates: Array<{ id: string; name: string; subject: string }>;
  lists: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
}) {
  const router = useRouter();
  const [seq, setSeq] = useState<Seq>(props.seq);
  const [tab, setTab] = useState<"steps" | "settings" | "enrollments" | "history">("steps");
  const [busy, startTransition] = useTransition();

  async function patch(body: Partial<Seq>) {
    const res = await fetch(`/api/engagement/sequences/${seq.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Failed to save");
      return null;
    }
    return res.json();
  }

  function toggleActive() {
    startTransition(async () => {
      const updated = await patch({ isActive: !seq.isActive });
      if (updated) {
        setSeq({ ...seq, isActive: updated.isActive });
        toast.success(updated.isActive ? "Sequence activated" : "Sequence paused");
        router.refresh();
      }
    });
  }

  function runNow() {
    startTransition(async () => {
      const res = await fetch(`/api/engagement/sequences/${seq.id}/run-now`, { method: "POST" });
      if (!res.ok) {
        toast.error("Run failed");
        return;
      }
      const j = await res.json();
      toast.success(
        `Enrolled ${j.enroll?.enrolled ?? 0}, processed ${j.process?.processed ?? 0}, advanced ${j.process?.advanced ?? 0}`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div
        className="bg-white rounded-xl p-5 flex items-start justify-between gap-4"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {seq.isActive ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e0f5e9] text-[#0d6b3b]">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ecebea] text-[#444656]">
                Paused
              </span>
            )}
            <span className="text-[12px] text-[#747474]">
              Entity: <span className="font-semibold">{seq.entityType}</span>
            </span>
            {seq.allowReEnroll ? (
              <span className="text-[12px] text-[#747474]">Re-enroll allowed</span>
            ) : (
              <span className="text-[12px] text-[#747474]">Once per lead</span>
            )}
          </div>
          {seq.description ? (
            <p className="text-[13px] text-[#444656]">{seq.description}</p>
          ) : (
            <p className="text-[13px] text-[#747474] italic">No description</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={runNow}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-[13px] font-semibold text-[#3052ff] bg-[#f2f3ff] disabled:opacity-60"
          >
            <Play className="size-3.5" />
            Run Now
          </button>
          <button
            onClick={toggleActive}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-[13px] font-semibold text-white disabled:opacity-60"
            style={{ background: seq.isActive ? "#942b00" : "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            {seq.isActive ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {seq.isActive ? "Pause" : "Activate"}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Total Enrolled" value={seq.totalEnrolled} />
        <StatTile label="Active" value={props.stats.active} accent="#3052ff" />
        <StatTile label="Paused" value={props.stats.paused} accent="#b48c00" />
        <StatTile label="Completed" value={props.stats.completed + seq.totalCompleted} accent="#0d6b3b" />
        <StatTile label="Exited" value={props.stats.exited + seq.totalExited} accent="#942b00" />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
        <div className="flex items-center border-b border-[#f2f3ff]">
          {(["steps", "settings", "enrollments", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "px-4 py-3 text-[13px] font-semibold border-b-2 -mb-px " +
                (tab === t
                  ? "text-[#3052ff] border-[#3052ff]"
                  : "text-[#444656] border-transparent hover:text-[#131b2e]")
              }
            >
              {t === "steps"
                ? `Steps (${seq.steps.length})`
                : t === "settings"
                ? "Settings"
                : t === "enrollments"
                ? "Enrollments"
                : "History"}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "steps" && (
            <StepsTab
              seq={seq}
              templates={props.templates}
              lists={props.lists}
              users={props.users}
              onChange={setSeq}
            />
          )}
          {tab === "settings" && <SettingsTab seq={seq} onChange={setSeq} />}
          {tab === "enrollments" && <EnrollmentsTab seqId={seq.id} />}
          {tab === "history" && <HistoryTab seqId={seq.id} />}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div
      className="bg-white rounded-xl p-4"
      style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
    >
      <div className="text-[11px] uppercase tracking-[0.5px] font-semibold text-[#444656]">
        {label}
      </div>
      <div
        className="text-[26px] font-bold mt-1"
        style={{ fontFamily: "Manrope, sans-serif", color: accent ?? "#131b2e" }}
      >
        {value}
      </div>
    </div>
  );
}

/* ============ STEPS TAB ============ */

function StepsTab(props: {
  seq: Seq;
  templates: Array<{ id: string; name: string; subject: string }>;
  lists: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  onChange: (s: Seq) => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState<StepKind>("send_email");

  async function refresh() {
    router.refresh();
  }

  async function addStep() {
    const config = defaultConfigFor(newKind, props.templates, props.lists, props.users);
    const res = await fetch(`/api/engagement/sequences/${props.seq.id}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: newKind, label: STEP_KIND_LABELS[newKind], config }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Failed to add step");
      return;
    }
    setAdding(false);
    toast.success("Step added");
    refresh();
  }

  async function deleteStep(stepId: string) {
    if (!confirm("Delete this step?")) return;
    const res = await fetch(`/api/engagement/sequences/${props.seq.id}/steps/${stepId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Step deleted");
    refresh();
  }

  async function move(stepId: string, dir: -1 | 1) {
    const idx = props.seq.steps.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= props.seq.steps.length) return;
    const a = props.seq.steps[idx];
    const b = props.seq.steps[swapIdx];
    const res = await fetch(`/api/engagement/sequences/${props.seq.id}/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        steps: [
          { id: a.id, order: b.order },
          { id: b.id, order: a.order },
        ],
      }),
    });
    if (!res.ok) {
      toast.error("Failed to reorder");
      return;
    }
    refresh();
  }

  async function patchStep(stepId: string, patch: { label?: string; config?: Record<string, unknown> }) {
    const res = await fetch(`/api/engagement/sequences/${props.seq.id}/steps/${stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Failed to save");
      return;
    }
    toast.success("Step saved");
    refresh();
  }

  return (
    <div className="space-y-3">
      {props.seq.steps.length === 0 ? (
        <div className="text-center py-10 text-[13px] text-[#747474]">
          No steps yet. Click <strong>Add Step</strong> below to begin.
        </div>
      ) : (
        <div className="space-y-3">
          {props.seq.steps.map((s, i) => (
            <StepCard
              key={s.id}
              step={s}
              index={i + 1}
              total={props.seq.steps.length}
              templates={props.templates}
              lists={props.lists}
              users={props.users}
              onMove={(d) => move(s.id, d)}
              onDelete={() => deleteStep(s.id)}
              onSave={(patch) => patchStep(s.id, patch)}
            />
          ))}
        </div>
      )}

      {adding ? (
        <div className="bg-[#fafaff] border border-[#f2f3ff] rounded p-4 flex items-center gap-3">
          <div className="text-[13px] font-semibold text-[#131b2e]">New step:</div>
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as StepKind)}
            className="px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
          >
            {STEP_KINDS.map((k) => (
              <option key={k} value={k}>
                {STEP_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <span className="text-[12px] text-[#747474] flex-1">
            {STEP_KIND_DESCRIPTIONS[newKind]}
          </span>
          <button
            onClick={addStep}
            className="px-3 py-1.5 rounded text-[12px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            Add
          </button>
          <button
            onClick={() => setAdding(false)}
            className="px-3 py-1.5 rounded text-[12px] font-semibold text-[#444656] bg-[#f2f3ff]"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded text-[13px] font-semibold text-[#3052ff] bg-[#f2f3ff] hover:bg-[#e8ebff]"
        >
          <Plus className="size-4" />
          Add Step
        </button>
      )}
    </div>
  );
}

function defaultConfigFor(
  kind: StepKind,
  templates: Array<{ id: string }>,
  lists: Array<{ id: string }>,
  _users: Array<{ id: string }>,
): Record<string, unknown> {
  switch (kind) {
    case "send_email":
      return { templateId: templates[0]?.id ?? "" };
    case "wait":
      return { days: 1, hours: 0 };
    case "branch_on_open":
    case "branch_on_click":
      return { yesGoToStepOrder: 0, noGoToStepOrder: 0, waitHours: 24 };
    case "update_score":
      return { delta: 10 };
    case "add_to_list":
    case "remove_from_list":
      return { listId: lists[0]?.id ?? "" };
    case "task":
      return { subject: "Follow up", dueOffsetDays: 1 };
    case "exit":
      return {};
  }
}

function StepCard(props: {
  step: Step;
  index: number;
  total: number;
  templates: Array<{ id: string; name: string; subject: string }>;
  lists: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
  onSave: (patch: { label?: string; config?: Record<string, unknown> }) => void;
}) {
  const [label, setLabel] = useState(props.step.label);
  const [config, setConfig] = useState<Record<string, unknown>>(props.step.config);
  const dirty =
    label !== props.step.label || JSON.stringify(config) !== JSON.stringify(props.step.config);

  return (
    <div className="border border-[#f2f3ff] rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="size-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            {props.index}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.4px] font-semibold text-[#747474]">
                {STEP_KIND_LABELS[props.step.kind as StepKind] ?? props.step.kind}
              </span>
            </div>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full text-[14px] font-semibold text-[#131b2e] bg-transparent outline-none focus:bg-[#fafaff] px-1 -mx-1 rounded"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => props.onMove(-1)}
            disabled={props.index === 1}
            className="p-1.5 rounded text-[#444656] hover:bg-[#f2f3ff] disabled:opacity-30"
            title="Move up"
          >
            <ChevronUpIcon className="size-4" />
          </button>
          <button
            onClick={() => props.onMove(1)}
            disabled={props.index === props.total}
            className="p-1.5 rounded text-[#444656] hover:bg-[#f2f3ff] disabled:opacity-30"
            title="Move down"
          >
            <ChevronDownIcon className="size-4" />
          </button>
          <button
            onClick={props.onDelete}
            className="p-1.5 rounded text-[#942b00] hover:bg-[#fff2ed]"
            title="Delete"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <StepInspector
        kind={props.step.kind as StepKind}
        config={config}
        onChange={setConfig}
        templates={props.templates}
        lists={props.lists}
        users={props.users}
        totalSteps={props.total}
      />

      {dirty && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => props.onSave({ label, config })}
            className="px-3 py-1.5 rounded text-[12px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            Save
          </button>
          <button
            onClick={() => {
              setLabel(props.step.label);
              setConfig(props.step.config);
            }}
            className="px-3 py-1.5 rounded text-[12px] font-semibold text-[#444656] bg-[#f2f3ff]"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function StepInspector(props: {
  kind: StepKind;
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
  templates: Array<{ id: string; name: string; subject: string }>;
  lists: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  totalSteps: number;
}) {
  function set<K extends string>(key: K, val: unknown) {
    props.onChange({ ...props.config, [key]: val });
  }

  switch (props.kind) {
    case "send_email": {
      const templateId = String(props.config.templateId ?? "");
      const fromUserId = String(props.config.fromUserId ?? "");
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FieldShell label="Template">
            <select
              value={templateId}
              onChange={(e) => set("templateId", e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            >
              <option value="">Pick a template</option>
              {props.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </FieldShell>
          <FieldShell label="From User (optional)">
            <select
              value={fromUserId}
              onChange={(e) => set("fromUserId", e.target.value || undefined)}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            >
              <option value="">Default From address</option>
              {props.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </FieldShell>
        </div>
      );
    }
    case "wait": {
      return (
        <div className="grid grid-cols-2 gap-3">
          <FieldShell label="Days">
            <input
              type="number"
              min={0}
              value={Number(props.config.days ?? 0)}
              onChange={(e) => set("days", Number(e.target.value))}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            />
          </FieldShell>
          <FieldShell label="Hours">
            <input
              type="number"
              min={0}
              value={Number(props.config.hours ?? 0)}
              onChange={(e) => set("hours", Number(e.target.value))}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            />
          </FieldShell>
        </div>
      );
    }
    case "branch_on_open":
    case "branch_on_click": {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FieldShell label="If yes, go to step #">
            <input
              type="number"
              min={0}
              max={props.totalSteps}
              value={Number(props.config.yesGoToStepOrder ?? 0)}
              onChange={(e) => set("yesGoToStepOrder", Number(e.target.value))}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            />
            <div className="text-[11px] text-[#747474] mt-1">0 = end sequence</div>
          </FieldShell>
          <FieldShell label="If no, go to step #">
            <input
              type="number"
              min={0}
              max={props.totalSteps}
              value={Number(props.config.noGoToStepOrder ?? 0)}
              onChange={(e) => set("noGoToStepOrder", Number(e.target.value))}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            />
            <div className="text-[11px] text-[#747474] mt-1">0 = end sequence</div>
          </FieldShell>
          <FieldShell label="Wait before evaluating (hours)">
            <input
              type="number"
              min={0}
              max={336}
              value={Number(props.config.waitHours ?? 24)}
              onChange={(e) => set("waitHours", Number(e.target.value))}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            />
          </FieldShell>
        </div>
      );
    }
    case "update_score": {
      return (
        <FieldShell label="Score delta (positive or negative)">
          <input
            type="number"
            value={Number(props.config.delta ?? 0)}
            onChange={(e) => set("delta", Number(e.target.value))}
            className="w-32 px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
          />
        </FieldShell>
      );
    }
    case "add_to_list":
    case "remove_from_list": {
      return (
        <FieldShell label="Lead List">
          <select
            value={String(props.config.listId ?? "")}
            onChange={(e) => set("listId", e.target.value)}
            className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
          >
            <option value="">Pick a list</option>
            {props.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </FieldShell>
      );
    }
    case "task": {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FieldShell label="Subject">
            <input
              value={String(props.config.subject ?? "")}
              onChange={(e) => set("subject", e.target.value)}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            />
          </FieldShell>
          <FieldShell label="Due in (days)">
            <input
              type="number"
              min={0}
              value={Number(props.config.dueOffsetDays ?? 0)}
              onChange={(e) => set("dueOffsetDays", Number(e.target.value))}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            />
          </FieldShell>
          <FieldShell label="Owner (optional)">
            <select
              value={String(props.config.ownerUserId ?? "")}
              onChange={(e) => set("ownerUserId", e.target.value || undefined)}
              className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            >
              <option value="">Unassigned</option>
              {props.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FieldShell>
        </div>
      );
    }
    case "exit":
      return (
        <div className="text-[12px] text-[#747474]">
          When reached, the enrollment is marked EXITED and no further steps run.
        </div>
      );
  }
}

function FieldShell(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.4px] font-semibold text-[#444656] mb-1">
        {props.label}
      </label>
      {props.children}
    </div>
  );
}

/* ============ SETTINGS TAB ============ */

function SettingsTab(props: { seq: Seq; onChange: (s: Seq) => void }) {
  const router = useRouter();
  const [name, setName] = useState(props.seq.name);
  const [description, setDescription] = useState(props.seq.description ?? "");
  const [allowReEnroll, setAllowReEnroll] = useState(props.seq.allowReEnroll);
  const [maxEnrollsPerTick, setMaxEnrollsPerTick] = useState(props.seq.maxEnrollsPerTick);
  const [criteria, setCriteria] = useState<Cond>(
    props.seq.entryCriteria ?? { kind: "and", conditions: [] },
  );

  async function save() {
    const res = await fetch(`/api/engagement/sequences/${props.seq.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description.trim() || null,
        allowReEnroll,
        maxEnrollsPerTick,
        entryCriteria: criteria,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Failed to save");
      return;
    }
    const updated = await res.json();
    toast.success("Settings saved");
    props.onChange({ ...props.seq, ...updated, entryCriteria: criteria });
    router.refresh();
  }

  async function deleteSeq() {
    if (!confirm("Delete this sequence and all enrollments? This cannot be undone.")) return;
    const res = await fetch(`/api/engagement/sequences/${props.seq.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Sequence deleted");
    router.push("/marketing/engagement");
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <FieldShell label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
        />
      </FieldShell>
      <FieldShell label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
        />
      </FieldShell>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <input
            id="reenr"
            type="checkbox"
            checked={allowReEnroll}
            onChange={(e) => setAllowReEnroll(e.target.checked)}
            className="size-4"
          />
          <label htmlFor="reenr" className="text-[13px] text-[#131b2e]">
            Allow re-enrollment
          </label>
        </div>
        <FieldShell label="Max enrolls per tick">
          <input
            type="number"
            min={1}
            value={maxEnrollsPerTick}
            onChange={(e) => setMaxEnrollsPerTick(Number(e.target.value))}
            className="w-32 px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
          />
        </FieldShell>
      </div>

      <div>
        <div className="text-[12px] font-semibold text-[#444656] uppercase tracking-[0.4px] mb-2">
          Entry Criteria
        </div>
        <p className="text-[12px] text-[#747474] mb-3">
          Leads matching these conditions get auto-enrolled by the cron. Leave empty to
          require manual enrollment only.
        </p>
        <ConditionBuilder cond={criteria} onChange={setCriteria} />
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-[#f2f3ff]">
        <button
          onClick={save}
          className="px-4 py-2 rounded text-[13px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          Save Settings
        </button>
        <button
          onClick={deleteSeq}
          className="ml-auto px-4 py-2 rounded text-[13px] font-semibold text-[#942b00] bg-[#fff2ed]"
        >
          Delete Sequence
        </button>
      </div>
    </div>
  );
}

function ConditionBuilder(props: { cond: Cond; onChange: (c: Cond) => void }) {
  function update(idx: number, patch: Partial<{ field: string; operator: string; value?: unknown }>) {
    const next = { ...props.cond, conditions: [...props.cond.conditions] };
    next.conditions[idx] = { ...next.conditions[idx], ...patch };
    props.onChange(next);
  }
  function add() {
    props.onChange({
      ...props.cond,
      conditions: [
        ...props.cond.conditions,
        { field: LEAD_FIELDS[0].key, operator: "equals", value: "" },
      ],
    });
  }
  function remove(idx: number) {
    const next = { ...props.cond, conditions: props.cond.conditions.filter((_, i) => i !== idx) };
    props.onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={props.cond.kind}
          onChange={(e) => props.onChange({ ...props.cond, kind: e.target.value as "and" | "or" })}
          className="px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
        >
          <option value="and">All conditions must match (AND)</option>
          <option value="or">Any condition matches (OR)</option>
        </select>
      </div>

      {props.cond.conditions.map((c, i) => {
        const showValue = c.operator !== "isNull" && c.operator !== "isNotNull";
        return (
          <div key={i} className="flex items-center gap-2">
            <select
              value={c.field}
              onChange={(e) => update(i, { field: e.target.value })}
              className="px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px] min-w-[180px]"
            >
              {LEAD_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={c.operator}
              onChange={(e) => update(i, { operator: e.target.value })}
              className="px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
            >
              {OPERATORS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {showValue && (
              <input
                value={String(c.value ?? "")}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="value"
                className="flex-1 px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
              />
            )}
            <button
              onClick={() => remove(i)}
              className="p-1.5 rounded text-[#942b00] hover:bg-[#fff2ed]"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}

      <button
        onClick={add}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] font-semibold text-[#3052ff] bg-[#f2f3ff]"
      >
        <Plus className="size-3.5" />
        Add condition
      </button>
    </div>
  );
}

/* ============ ENROLLMENTS TAB ============ */

type Enrollment = {
  id: string;
  entityType: string;
  entityId: string;
  status: string;
  currentStepOrder: number;
  enteredAt: string;
  finishedAt: string | null;
  nextActionAt: string | null;
  lead: { id: string; businessName: string; contactName: string; email: string | null } | null;
};

function EnrollmentsTab({ seqId }: { seqId: string }) {
  const [items, setItems] = useState<Enrollment[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [manualLeadId, setManualLeadId] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (status) params.set("status", status);
    const res = await fetch(`/api/engagement/sequences/${seqId}/enrollments?${params}`);
    if (res.ok) {
      const j = await res.json();
      setItems(j.items);
      setTotal(j.total);
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [status, page]);

  async function manualEnroll() {
    if (!manualLeadId.trim()) return;
    const res = await fetch(`/api/engagement/sequences/${seqId}/enrollments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: manualLeadId.trim() }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? "Failed to enroll");
      return;
    }
    toast.success("Lead enrolled");
    setManualLeadId("");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px]"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="COMPLETED">Completed</option>
          <option value="EXITED">Exited</option>
        </select>
        <div className="text-[12px] text-[#747474]">{total} total</div>
        <div className="flex-1" />
        <input
          value={manualLeadId}
          onChange={(e) => setManualLeadId(e.target.value)}
          placeholder="Lead ID (cuid)"
          className="px-2.5 py-1.5 border border-[#c9c9c9] rounded text-[13px] w-56"
        />
        <button
          onClick={manualEnroll}
          className="px-3 py-1.5 rounded text-[13px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          Enroll Lead
        </button>
      </div>

      {loading ? (
        <div className="text-[13px] text-[#747474]">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-[13px] text-[#747474] py-6 text-center">No enrollments yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[#fafaff]">
              <tr>
                {["Lead", "Status", "Step", "Entered", "Next Action", "Finished"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 text-[11px] uppercase tracking-[0.4px] font-semibold text-[#444656] border-b border-[#f2f3ff]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-b border-[#f2f3ff] last:border-b-0">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-[#131b2e]">
                      {e.lead?.businessName ?? e.entityId}
                    </div>
                    <div className="text-[11px] text-[#747474]">
                      {e.lead?.contactName} · {e.lead?.email ?? "(no email)"}
                    </div>
                  </td>
                  <td className="px-3 py-2">{e.status}</td>
                  <td className="px-3 py-2">{e.currentStepOrder + 1}</td>
                  <td className="px-3 py-2 text-[#747474]">{new Date(e.enteredAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-[#747474]">
                    {e.nextActionAt ? new Date(e.nextActionAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-2 text-[#747474]">
                    {e.finishedAt ? new Date(e.finishedAt).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div className="flex items-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded text-[12px] font-semibold text-[#444656] bg-[#f2f3ff] disabled:opacity-50"
          >
            Prev
          </button>
          <div className="text-[12px] text-[#747474]">
            Page {page} of {Math.ceil(total / 50)}
          </div>
          <button
            disabled={page >= Math.ceil(total / 50)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded text-[12px] font-semibold text-[#444656] bg-[#f2f3ff] disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/* ============ HISTORY TAB (rolled up across enrollments) ============ */

function HistoryTab({ seqId }: { seqId: string }) {
  const [items, setItems] = useState<
    Array<{ at: string; stepOrder: number; kind: string; label: string; result: string; leadId: string; error?: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/engagement/sequences/${seqId}/enrollments?pageSize=100`);
      if (res.ok) {
        const j = await res.json();
        const flat: typeof items = [];
        for (const enr of j.items as Array<{ entityId: string; history?: Array<{ at: string; stepOrder: number; kind: string; label: string; result: string; error?: string }> }>) {
          const hist = Array.isArray(enr.history) ? enr.history : [];
          for (const h of hist) {
            flat.push({ ...h, leadId: enr.entityId });
          }
        }
        flat.sort((a, b) => (a.at < b.at ? 1 : -1));
        setItems(flat.slice(0, 200));
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-[13px] text-[#747474]">Loading...</div>;
  if (items.length === 0)
    return <div className="text-[13px] text-[#747474] py-6 text-center">No history yet.</div>;

  return (
    <div className="space-y-2">
      {items.map((h, i) => (
        <div key={i} className="flex items-start gap-3 px-3 py-2 border-b border-[#f2f3ff]">
          <Activity className="size-4 text-[#3052ff] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-[#131b2e]">
              <span className="font-semibold">{h.label}</span>{" "}
              <span className="text-[12px] text-[#747474]">({h.kind})</span>
            </div>
            <div className="text-[11px] text-[#747474]">
              Lead {h.leadId.slice(0, 10)}... · step {h.stepOrder + 1} ·{" "}
              {new Date(h.at).toLocaleString()}
            </div>
            {h.error && <div className="text-[12px] text-[#942b00] mt-1">{h.error}</div>}
          </div>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: h.result === "OK" ? "#e0f5e9" : "#fff2ed",
              color: h.result === "OK" ? "#0d6b3b" : "#942b00",
            }}
          >
            {h.result}
          </span>
        </div>
      ))}
    </div>
  );
}

