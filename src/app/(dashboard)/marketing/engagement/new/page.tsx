"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NewEngagementSequencePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [allowReEnroll, setAllowReEnroll] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/engagement/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          entityType: "Lead",
          allowReEnroll,
          isActive,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Failed to create sequence");
        setSaving(false);
        return;
      }
      const seq = await res.json();
      toast.success("Sequence created");
      router.push(`/marketing/engagement/${seq.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create sequence");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1
          className="text-[24px] font-bold tracking-tight text-[#131b2e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          New Engagement Sequence
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> /{" "}
          <Link href="/marketing/engagement" className="text-[#3052ff]">Engagement</Link> / New
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white rounded-xl p-6 space-y-5"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div>
          <label className="block text-[12px] font-semibold text-[#444656] mb-1.5">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Welcome Drip"
            className="w-full px-3 py-2 border border-[#d8dde6] rounded text-[13px] text-[#131b2e] outline-none focus:border-[#3052ff]"
            required
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-[#444656] mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What this sequence is for, what it sends, who it targets."
            className="w-full px-3 py-2 border border-[#d8dde6] rounded text-[13px] text-[#131b2e] outline-none focus:border-[#3052ff]"
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-[#444656] mb-1.5">Entity Type</label>
          <div className="text-[13px] text-[#444656]">
            Lead <span className="text-[#706e6b]">(only Lead is wired in v1)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="allowReEnroll"
            type="checkbox"
            checked={allowReEnroll}
            onChange={(e) => setAllowReEnroll(e.target.checked)}
            className="size-4"
          />
          <label htmlFor="allowReEnroll" className="text-[13px] text-[#131b2e]">
            Allow re-enrollment
          </label>
          <span className="text-[12px] text-[#706e6b]">
            (off by default — matches Pardot behavior)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="isActive"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4"
          />
          <label htmlFor="isActive" className="text-[13px] text-[#131b2e]">
            Activate now
          </label>
          <span className="text-[12px] text-[#706e6b]">
            (you can activate after adding steps + criteria)
          </span>
        </div>

        <div className="pt-3 border-t border-[#f2f3ff] flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            {saving ? "Creating..." : "Create Sequence"}
          </button>
          <Link
            href="/marketing/engagement"
            className="px-4 py-2 rounded text-[13px] font-semibold text-[#444656] bg-[#f2f3ff]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
