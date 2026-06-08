"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "@/components/icons/lucide";

export function DeleteReportButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this report?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to delete report");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12px] font-semibold text-[#942b00] bg-[#fff2ef] disabled:opacity-50"
    >
      <Trash2 className="size-3" />
      Delete
    </button>
  );
}
