"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QuickActionsRow } from "@/components/quick-actions/quick-actions-row";

export function ContactHeaderButtons({
  contactId,
  defaultEmail,
  defaultPhone,
}: {
  contactId: string;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleFollow() {
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

  // SF-exact pill buttons: white with thin border, blue label, tiny corner radius.
  const btn: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #c9c9c9",
    borderRadius: 4,
    padding: "0 12px",
    height: 32,
    fontSize: 13,
    fontWeight: 600,
    color: "#0176d3",
    cursor: "pointer",
    fontFamily: "inherit",
    lineHeight: "26px",
  };

  const dropdownBtn: React.CSSProperties = {
    ...btn,
    padding: "0 6px",
    minWidth: 28,
  };

  return (
    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <QuickActionsRow contactId={contactId} defaultEmail={defaultEmail} defaultPhone={defaultPhone} />
      <button onClick={toggleFollow} disabled={busy !== null} style={btn}>
        {busy === "follow" ? "…" : "+ Follow"}
      </button>
      <button onClick={newTask} disabled={busy !== null} style={btn}>
        New Case
      </button>
      <button style={btn}>New Note</button>
      <button onClick={newTask} disabled={busy !== null} style={btn}>
        {busy === "task" ? "…" : "New Task"}
      </button>
      <button style={dropdownBtn} aria-label="More actions">
        <svg width="10" height="10" viewBox="0 0 24 24" style={{ fill: "#0176d3", verticalAlign: "middle" }}>
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
    </div>
  );
}
