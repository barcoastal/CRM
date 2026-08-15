"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@/components/icons/lucide";
import { SUPPORTED_ENTITIES } from "@/lib/flow/nodes";

export default function NewFlowPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState<string>("Lead");
  const [triggerEvent, setTriggerEvent] = useState<string>("INSERT_OR_UPDATE");
  const [inactivityDays, setInactivityDays] = useState<number>(14);
  const [reentryPolicy, setReentryPolicy] = useState<string>("ALWAYS");
  const [reentryCooldownDays, setReentryCooldownDays] = useState<number>(30);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          entityType,
          triggerEvent,
          isActive,
          reentryPolicy,
          reentryCooldownDays,
          inactivityDays: triggerEvent === "INACTIVITY" ? inactivityDays : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
        setSaving(false);
        return;
      }
      router.push(`/automation/flows/${data.flow.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <Link
        href="/automation/flows"
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#3052ff]"
      >
        <ArrowLeft className="size-3" /> Back to Flows
      </Link>
      <div>
        <h1
          className="text-[24px] font-bold tracking-tight text-[#131b2e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          New Flow
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          Pick the entity and trigger event. You will build the graph and entry criteria in the editor.
        </p>
      </div>

      <div
        className="bg-white rounded-xl p-5 space-y-4"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div>
          <label className="block text-[12px] font-semibold text-[#444656] mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Send welcome email when new Account becomes Active"
            className="w-full px-3 py-2 text-[13px] border border-[#e0dfe6] rounded focus:border-[#3052ff] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#444656] mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What does this flow do?"
            className="w-full px-3 py-2 text-[13px] border border-[#e0dfe6] rounded focus:border-[#3052ff] focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#444656] mb-1">Entity</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-[#e0dfe6] rounded focus:border-[#3052ff] focus:outline-none bg-white"
            >
              {SUPPORTED_ENTITIES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#444656] mb-1">Trigger Event</label>
            <select
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-[#e0dfe6] rounded focus:border-[#3052ff] focus:outline-none bg-white"
            >
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="INSERT_OR_UPDATE">INSERT_OR_UPDATE</option>
              <option value="INACTIVITY">Inactivity (no touch in N days)</option>
            </select>
          </div>
        </div>
        {triggerEvent === "INACTIVITY" ? (
          <div>
            <label className="block text-[12px] font-semibold text-[#444656] mb-1">
              Days without activity
            </label>
            <input
              type="number"
              min={1}
              value={inactivityDays}
              onChange={(e) => setInactivityDays(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 text-[13px] border border-[#e0dfe6] rounded focus:border-[#3052ff] focus:outline-none"
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#444656] mb-1">Re-entry</label>
            <select
              value={reentryPolicy}
              onChange={(e) => setReentryPolicy(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-[#e0dfe6] rounded focus:border-[#3052ff] focus:outline-none bg-white"
            >
              <option value="ALWAYS">Every trigger</option>
              <option value="ONCE">Once per record</option>
              <option value="COOLDOWN">Cooldown</option>
            </select>
          </div>
          {reentryPolicy === "COOLDOWN" ? (
            <div>
              <label className="block text-[12px] font-semibold text-[#444656] mb-1">Cooldown days</label>
              <input
                type="number"
                min={1}
                value={reentryCooldownDays}
                onChange={(e) => setReentryCooldownDays(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-[13px] border border-[#e0dfe6] rounded focus:border-[#3052ff] focus:outline-none"
              />
            </div>
          ) : null}
        </div>
        <div>
          <label className="inline-flex items-center gap-2 text-[13px] text-[#444656]">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active (will fire on matching events)
          </label>
        </div>
        {error ? (
          <div className="px-3 py-2 rounded text-[12px] font-semibold bg-[#fde2e2] text-[#9d1414]">
            {error}
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f2f3ff]">
          <Link
            href="/automation/flows"
            className="px-3 py-1.5 rounded text-[12px] font-semibold text-[#444656] bg-[#ecebea]"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="px-3 py-1.5 rounded text-[12px] font-semibold text-white"
            style={{ background: saving ? "#9c9bb5" : "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            {saving ? "Creating..." : "Create Flow"}
          </button>
        </div>
      </div>
    </div>
  );
}
