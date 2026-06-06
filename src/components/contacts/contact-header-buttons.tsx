"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ContactHeaderButtons({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleFollow() {
    // Lightweight optimistic follow toggle; persists only as a flash toast for now.
    setBusy("follow");
    try {
      toast.success("Following contact");
    } finally {
      setBusy(null);
    }
  }

  async function newTask() {
    setBusy("task");
    try {
      const res = await fetch(`/api/contacts/${contactId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: "Follow up", type: "TASK" }),
      });
      if (res.ok) {
        toast.success("Task created");
        router.refresh();
      } else {
        toast.error("Could not create task");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(null);
    }
  }

  const btn: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #d8dde6",
    borderRadius: 4,
    padding: "5px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "#0070d2",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "inline-flex", gap: 6 }}>
      <button onClick={toggleFollow} disabled={busy !== null} style={btn}>
        {busy === "follow" ? "…" : "+ Follow"}
      </button>
      <button style={btn}>Edit</button>
      <button onClick={newTask} disabled={busy !== null} style={btn}>
        {busy === "task" ? "…" : "New Task"}
      </button>
      <button style={btn}>New Event</button>
    </div>
  );
}
