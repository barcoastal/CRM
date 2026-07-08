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

/** Default startAt = now (rounded to next 15m), endAt = +1h. */
function defaultStart(): string {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return toLocalInput(d);
}
function defaultEnd(start: string): string {
  const d = start ? new Date(start) : new Date();
  d.setHours(d.getHours() + 1);
  return toLocalInput(d);
}
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * SF-parity "New Event" modal. Saves an Event row linked to whichever entity
 * id was passed in.
 */
export function NewEventModal({ open, onClose, leadId, opportunityId, accountId, contactId }: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(() => defaultEnd(defaultStart()));
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function save() {
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!startAt || !endAt) {
      toast.error("Start and End are required");
      return;
    }
    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      toast.error("End must be at or after Start");
      return;
    }
    setBusy(true);
    try {
      // Attendees are appended to description so they appear in Activity rail;
      // the Event model has no dedicated attendees field in this schema.
      const note = [description, attendees ? `Attendees: ${attendees}` : null]
        .filter(Boolean)
        .join("\n\n") || undefined;
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          location: location || undefined,
          description: note,
          leadId,
          opportunityId,
          accountId,
          contactId,
        }),
      });
      if (res.ok) {
        toast.success("Event created");
        setSubject("");
        setLocation("");
        setAttendees("");
        setDescription("");
        onClose();
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Could not create event");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onClick={() => !busy && onClose()}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>New Event</h2>
          <button onClick={onClose} style={iconBtn}>X</button>
        </div>
        <div style={body}>
          <label style={lbl}>Subject *</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Meeting subject" style={input} autoFocus />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Start *</label>
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} style={input} />
            </div>
            <div>
              <label style={lbl}>End *</label>
              <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} style={input} />
            </div>
          </div>
          <label style={lbl}>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office / Zoom / Phone" style={input} />
          <label style={lbl}>Attendees</label>
          <input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="emails or names, comma-separated" style={input} />
          <label style={lbl}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ ...input, height: "auto", fontFamily: "inherit", resize: "vertical" }} />
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
