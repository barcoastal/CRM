"use client";

import { use, useEffect, useState } from "react";

interface Slot { iso: string; label: string }

export default function BookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<{ clientName: string | null; status: string; requestedAt: string | null; slots: Slot[] } | null>(null);
  const [picked, setPicked] = useState<string>("");
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/book/${token}`).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null));
  }, [token]);

  async function book() {
    if (!picked) return;
    setBooking(true); setErr(null);
    try {
      const res = await fetch(`/api/book/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot: picked }) });
      if (res.ok) setDone(true);
      else setErr((await res.json().catch(() => ({}))).error ?? "Could not book.");
    } finally { setBooking(false); }
  }

  const wrap: React.CSSProperties = { minHeight: "100vh", background: "linear-gradient(180deg,#eef2fb,#dce6f7)", fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px" };
  const card: React.CSSProperties = { background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(22,50,92,0.12)", padding: 28, maxWidth: 460, width: "100%" };

  if (data === null) return <div style={wrap}><div style={card}>Loading...</div></div>;
  if ((data as { error?: string }).error || !data.status) return <div style={wrap}><div style={card}>This link is no longer valid.</div></div>;

  const already = data.status !== "SENT" || done;

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0176d3", letterSpacing: 0.5, textTransform: "uppercase" }}>Coastal Debt Resolve</div>
        {already ? (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#16325c", margin: "10px 0" }}>You&apos;re booked ✓</h1>
            <p style={{ fontSize: 14, color: "#5c6b7a", lineHeight: 1.6 }}>Thanks{data.clientName ? `, ${data.clientName}` : ""}. A specialist will call you at your selected time. If you need to change it, just reply to our email.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#16325c", margin: "10px 0 4px" }}>Schedule your call</h1>
            <p style={{ fontSize: 14, color: "#5c6b7a", margin: "0 0 16px" }}>Pick a time and one of our specialists will call you.</p>
            <div style={{ maxHeight: 320, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {data.slots.map((s) => (
                <button key={s.iso} onClick={() => setPicked(s.iso)}
                  style={{ padding: "10px 8px", fontSize: 13, borderRadius: 8, cursor: "pointer", textAlign: "left",
                    border: picked === s.iso ? "2px solid #0176d3" : "1px solid #d8dde6",
                    background: picked === s.iso ? "#eaf4ff" : "#fff", color: "#16325c", fontWeight: picked === s.iso ? 700 : 500 }}>
                  {s.label}
                </button>
              ))}
              {data.slots.length === 0 && <div style={{ color: "#8a94a6", fontSize: 13 }}>No times available right now.</div>}
            </div>
            {err && <div style={{ color: "#b3261e", fontSize: 13, marginTop: 10 }}>{err}</div>}
            <button onClick={book} disabled={!picked || booking}
              style={{ marginTop: 18, width: "100%", background: picked ? "#0176d3" : "#c9d4e3", color: "#fff", border: 0, borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: picked ? "pointer" : "default" }}>
              {booking ? "Booking..." : "Confirm my call"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
