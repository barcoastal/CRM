"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NewLeadListPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/engagement/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Failed to create list");
        setSaving(false);
        return;
      }
      const list = await res.json();
      toast.success("List created");
      router.push(`/marketing/engagement/lists/${list.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create list");
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
          New Lead List
        </h1>
        <p className="text-[13px] text-[#444656] mt-1">
          <Link href="/marketing" className="text-[#3052ff]">Marketing</Link> /{" "}
          <Link href="/marketing/engagement" className="text-[#3052ff]">Engagement</Link> /{" "}
          <Link href="/marketing/engagement/lists" className="text-[#3052ff]">Lead Lists</Link> / New
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
            placeholder="e.g. Hot Leads"
            className="w-full px-3 py-2 border border-[#d8dde6] rounded text-[13px] outline-none focus:border-[#3052ff]"
            required
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-[#444656] mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-[#d8dde6] rounded text-[13px] outline-none focus:border-[#3052ff]"
          />
        </div>

        <div className="pt-3 border-t border-[#f2f3ff] flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-[13px] font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            {saving ? "Creating..." : "Create List"}
          </button>
          <Link
            href="/marketing/engagement/lists"
            className="px-4 py-2 rounded text-[13px] font-semibold text-[#444656] bg-[#f2f3ff]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
