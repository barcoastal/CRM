"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "+ New Task" control in the Checklist card header. Creates a CHECKLIST task
 *  on the account and refreshes so it appears in the list. */
export function ChecklistNewTask({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!subject.trim()) { setErr("Enter a task name."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType: "CHECKLIST",
          accountId,
          subject: subject.trim(),
          dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
        }),
      });
      if (res.ok) { setSubject(""); setDueDate(""); setOpen(false); router.refresh(); }
      else setErr((await res.json().catch(() => ({}))).error ?? "Could not add the task.");
    } finally { setBusy(false); }
  }

  return (
    <div style={{ marginLeft: "auto", position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="New task"
        style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, color: "#0176d3", fontSize: 12, fontWeight: 600, padding: "3px 10px", cursor: "pointer" }}
      >
        + New Task
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 20, width: 240, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", padding: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#444", display: "block", marginBottom: 3 }}>Task</label>
          <input
            autoFocus value={subject} onChange={(e) => setSubject(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
            style={{ width: "100%", border: "1px solid #c9c9c9", borderRadius: 4, padding: "6px 8px", fontSize: 13, boxSizing: "border-box", marginBottom: 8 }}
          />
          <label style={{ fontSize: 11, fontWeight: 700, color: "#444", display: "block", marginBottom: 3 }}>Due date</label>
          <input
            type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            style={{ width: "100%", border: "1px solid #c9c9c9", borderRadius: 4, padding: "6px 8px", fontSize: 13, boxSizing: "border-box", marginBottom: 8 }}
          />
          {err && <div style={{ color: "#c0392b", fontSize: 11, marginBottom: 6 }}>{err}</div>}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setOpen(false)} style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>Cancel</button>
            <button onClick={save} disabled={busy} style={{ background: "#0176d3", color: "#fff", border: 0, borderRadius: 4, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Adding..." : "Add"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
