"use client";

import { useEffect, useState } from "react";

interface Slot { iso: string; label: string }

export default function GenericBookPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/book").then((r) => (r.ok ? r.json() : { slots: [] })).then((d) => setSlots(d.slots ?? [])).catch(() => {});
  }, []);

  async function book() {
    setErr(null);
    if (!name.trim()) return setErr("Please enter your name.");
    if (!picked) return setErr("Please pick a time.");
    setBusy(true);
    try {
      const res = await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email: email || null, phone: phone || null, slot: picked }) });
      if (res.ok) setDone(true);
      else setErr((await res.json().catch(() => ({}))).error ?? "Could not book.");
    } finally { setBusy(false); }
  }

  const wrap: React.CSSProperties = { minHeight: "100vh", background: "linear-gradient(180deg,#eef2fb,#dce6f7)", fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px" };
  const card: React.CSSProperties = { background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(22,50,92,0.12)", padding: 28, maxWidth: 480, width: "100%" };
  const input: React.CSSProperties = { width: "100%", border: "1px solid #d8dde6", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginBottom: 10, boxSizing: "border-box", color: "#16325c" };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0176d3", letterSpacing: 0.5, textTransform: "uppercase" }}>Coastal Debt Resolve</div>
        {done ? (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#16325c", margin: "10px 0" }}>You&apos;re booked ✓</h1>
            <p style={{ fontSize: 14, color: "#5c6b7a", lineHeight: 1.6 }}>Thanks, {name}. A specialist will call you at your selected time.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#16325c", margin: "10px 0 4px" }}>Schedule your call</h1>
            <p style={{ fontSize: 14, color: "#5c6b7a", margin: "0 0 16px" }}>Tell us who you are and pick a time - a specialist will call you.</p>
            <input style={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <input style={input} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input style={input} placeholder="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div style={{ fontSize: 13, fontWeight: 700, color: "#16325c", margin: "8px 0 6px" }}>Pick a time (Eastern)</div>
            <div style={{ maxHeight: 260, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {slots.map((s) => (
                <button key={s.iso} onClick={() => setPicked(s.iso)}
                  style={{ padding: "10px 8px", fontSize: 13, borderRadius: 8, cursor: "pointer", textAlign: "left",
                    border: picked === s.iso ? "2px solid #0176d3" : "1px solid #d8dde6",
                    background: picked === s.iso ? "#eaf4ff" : "#fff", color: "#16325c", fontWeight: picked === s.iso ? 700 : 500 }}>
                  {s.label}
                </button>
              ))}
              {slots.length === 0 && <div style={{ color: "#8a94a6", fontSize: 13 }}>Loading times...</div>}
            </div>
            {err && <div style={{ color: "#b3261e", fontSize: 13, marginTop: 10 }}>{err}</div>}
            <button onClick={book} disabled={busy}
              style={{ marginTop: 16, width: "100%", background: "#0176d3", color: "#fff", border: 0, borderRadius: 8, padding: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Booking..." : "Confirm my call"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
