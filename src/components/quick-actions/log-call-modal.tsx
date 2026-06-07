"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type EntityProps = {
  leadId?: string;
  defaultPhone?: string | null;
};

type Props = EntityProps & {
  open: boolean;
  onClose: () => void;
};

const DISPOSITIONS = [
  "INTERESTED",
  "NOT_INTERESTED",
  "CALLBACK",
  "NOT_QUALIFIED",
  "WRONG_NUMBER",
  "VOICEMAIL",
  "NO_ANSWER",
  "DNC",
  "ENROLLED",
] as const;

/**
 * SF-parity "Log a Call" modal. Creates a Call row (with status COMPLETED)
 * linked to the lead so the Activities tab + Activity rail surface it.
 * Currently the Call schema only supports leadId — for opp/account/contact
 * we still create the call but with the leadId omitted; the modal hides the
 * link in that case.
 */
export function LogCallModal({ open, onClose, leadId, defaultPhone }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [disposition, setDisposition] = useState<string>("INTERESTED");
  const [duration, setDuration] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function save() {
    if (!phone.trim()) {
      toast.error("Phone is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/calls/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone,
          disposition,
          duration: duration ? Number(duration) : undefined,
          notes: notes || undefined,
          leadId,
        }),
      });
      if (res.ok) {
        toast.success("Call logged");
        setNotes("");
        setDuration("");
        onClose();
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Could not log call");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onClick={() => !busy && onClose()}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Log a Call</h2>
          <button onClick={onClose} style={iconBtn}>X</button>
        </div>
        <div style={body}>
          <label style={lbl}>Phone *</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" style={input} autoFocus />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Disposition *</label>
              <select value={disposition} onChange={(e) => setDisposition(e.target.value)} style={input}>
                {DISPOSITIONS.map((d) => (
                  <option key={d} value={d}>{d.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Duration (seconds)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="120" style={input} />
            </div>
          </div>
          <label style={lbl}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="What was discussed?" style={{ ...input, height: "auto", fontFamily: "inherit", resize: "vertical" }} />
        </div>
        <div style={foot}>
          <button onClick={onClose} disabled={busy} style={btnSecondary}>Cancel</button>
          <button onClick={save} disabled={busy || !phone.trim()} style={btnPrimary}>
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
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#706e6b", marginBottom: 4, marginTop: 12 };
const input: React.CSSProperties = { width: "100%", padding: "6px 8px", border: "1px solid #d8dde6", borderRadius: 4, fontSize: 13, boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { background: "#0070d2", color: "#fff", padding: "8px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, border: 0, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { background: "#fff", color: "#0070d2", padding: "8px 16px", borderRadius: 4, fontSize: 13, fontWeight: 600, border: "1px solid #0070d2", cursor: "pointer" };
const iconBtn: React.CSSProperties = { background: "transparent", border: 0, fontSize: 16, cursor: "pointer", color: "#706e6b" };
