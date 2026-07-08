"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type EntityProps = {
  leadId?: string;
  opportunityId?: string;
  accountId?: string;
  contactId?: string;
};

type Props = EntityProps & {
  open: boolean;
  onClose: () => void;
};

/**
 * SF-parity "New Task" modal. Saves a Task row linked to whichever entity id
 * was passed in. After save the page is refreshed so the new row appears in
 * the Activities tab + Activity rail without a full reload.
 */
export function NewTaskModal({ open, onClose, leadId, opportunityId, accountId, contactId }: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH">("NORMAL");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function save() {
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          notes: description || undefined,
          leadId,
          opportunityId,
          accountId,
          contactId,
        }),
      });
      if (res.ok) {
        toast.success("Task created");
        setSubject("");
        setDueDate("");
        setDescription("");
        setPriority("NORMAL");
        onClose();
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Could not create task");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onClick={() => !busy && onClose()}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>New Task</h2>
          <button onClick={onClose} style={iconBtn}>X</button>
        </div>
        <div style={body}>
          <label style={lbl}>Subject *</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Call back, follow up..." style={input} autoFocus />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={input} />
            </div>
            <div>
              <label style={lbl}>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as "LOW" | "NORMAL" | "HIGH")} style={input}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <label style={lbl}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} style={{ ...input, height: "auto", fontFamily: "inherit", resize: "vertical" }} />
        </div>
        <div style={foot}>
          <button onClick={onClose} disabled={busy} style={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={busy || !subject.trim()} style={btnPrimary}>
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 8, width: 520, maxWidth: "90vw", display: "flex", flexDirection: "column" };
const head: React.CSSProperties = { padding: "16px 20px", borderBottom: "1px solid #ecebea", display: "flex", justifyContent: "space-between", alignItems: "center" };
const body: React.CSSProperties = { padding: 20 };
const foot: React.CSSProperties = { padding: "12px 20px", borderTop: "1px solid #ecebea", display: "flex", justifyContent: "flex-end", gap: 8 };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#747474", marginBottom: 4, marginTop: 12 };
const input: React.CSSProperties = { width: "100%", padding: "6px 8px", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13, boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { background: "#0176d3", color: "#fff", padding: "8px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, border: 0, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "#fff", color: "#0176d3", padding: "8px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, border: "1px solid #0176d3", cursor: "pointer" };
const iconBtn: React.CSSProperties = { background: "transparent", border: 0, fontSize: 16, cursor: "pointer", color: "#747474" };
