"use client";

import { useState } from "react";

type Fields = {
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
};

export function PublicIntakeForm({ token, initial }: { token: string; initial: Fields }) {
  const [f, setF] = useState<Fields & { notes: string }>({ ...initial, notes: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error === "expired" ? "This link has expired." : "Could not submit, please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error, please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div
        style={{
          padding: "14px 16px",
          background: "#eaf5ec",
          border: "1px solid #b7e1c2",
          borderRadius: 6,
          fontSize: 14,
          color: "#2e844a",
          fontWeight: 600,
        }}
      >
        Thank you. Your information has been received.
      </div>
    );
  }

  return (
    <div>
      <label style={lbl}>Street address</label>
      <input value={f.street} onChange={set("street")} style={inp} placeholder="123 Main St" />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
        <div>
          <label style={lbl}>City</label>
          <input value={f.city} onChange={set("city")} style={inp} />
        </div>
        <div>
          <label style={lbl}>State</label>
          <input value={f.state} onChange={set("state")} style={inp} placeholder="NY" />
        </div>
        <div>
          <label style={lbl}>ZIP</label>
          <input value={f.zip} onChange={set("zip")} style={inp} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={lbl}>Phone</label>
          <input value={f.phone} onChange={set("phone")} style={inp} type="tel" />
        </div>
        <div>
          <label style={lbl}>Email</label>
          <input value={f.email} onChange={set("email")} style={inp} type="email" />
        </div>
      </div>

      <label style={lbl}>Anything else we should know?</label>
      <textarea
        value={f.notes}
        onChange={set("notes")}
        rows={4}
        style={{ ...inp, height: "auto", padding: 8, resize: "vertical" }}
        placeholder="Optional"
      />

      {error && (
        <div style={{ margin: "4px 0 12px", fontSize: 13, color: "#c23934" }}>{error}</div>
      )}

      <button
        onClick={submit}
        disabled={busy}
        style={{
          marginTop: 8,
          width: "100%",
          background: "#0176d3",
          border: "none",
          padding: "12px",
          borderRadius: 4,
          fontSize: 15,
          fontWeight: 600,
          color: "#fff",
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Submitting..." : "Submit my information"}
      </button>
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#444444",
  margin: "12px 0 4px",
};
const inp: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 10px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 14,
  boxSizing: "border-box",
};
