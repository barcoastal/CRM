"use client";

import { useEffect, useMemo, useState } from "react";

interface Slot { iso: string; dateKey: string; timeLabel: string; label: string }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const pad = (n: number) => String(n).padStart(2, "0");

export default function GenericBookPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const [date, setDate] = useState<string | null>(null); // dateKey
  const [slot, setSlot] = useState<string | null>(null); // iso
  const [step, setStep] = useState<"pick" | "details" | "done">("pick");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/book").then((r) => (r.ok ? r.json() : { slots: [] })).then((d) => {
      const ss: Slot[] = d.slots ?? [];
      setSlots(ss);
      if (ss[0]) { const [y, m] = ss[0].dateKey.split("-").map(Number); setView({ y, m: m - 1 }); }
    }).catch(() => {});
  }, []);

  // Prefill from Pardot merge fields passed on the link
  // (e.g. /book?name=%%first_name%%%20%%last_name%%&email=%%email%%&phone=%%phone%%).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const nm = (q.get("name") ?? [q.get("first"), q.get("last")].filter(Boolean).join(" ")).trim();
    if (nm) setName(nm);
    const em = q.get("email"); if (em) setEmail(em.trim());
    const ph = q.get("phone"); if (ph) setPhone(ph.trim());
  }, []);

  const byDate = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) { const a = m.get(s.dateKey) ?? []; a.push(s); m.set(s.dateKey, a); }
    return m;
  }, [slots]);

  const times = date ? byDate.get(date) ?? [] : [];
  const selectedLabel = slot ? slots.find((s) => s.iso === slot)?.label : null;

  async function schedule() {
    setErr(null);
    if (!name.trim()) return setErr("Please enter your name.");
    setBusy(true);
    try {
      const res = await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email: email || null, phone: phone || null, slot }) });
      if (res.ok) setStep("done");
      else setErr((await res.json().catch(() => ({}))).error ?? "Could not book.");
    } finally { setBusy(false); }
  }

  const ink = "#1a1a1a", muted = "#73819a", blue = "#0069ff";
  const wrap: React.CSSProperties = { minHeight: "100vh", background: "#f3f4f8", fontFamily: "'Inter',-apple-system,Segoe UI,Roboto,Arial,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" };
  const cardBase: React.CSSProperties = { background: "#fff", borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.10)", border: "1px solid #e6e8ef", overflow: "hidden", width: "100%" };

  // --- Left event panel (Calendly style) ---
  const left = (
    <div style={{ padding: "28px 26px", borderRight: "1px solid #eceef3", minWidth: 300, maxWidth: 320 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: muted }}>Coastal Debt Resolve</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: ink, margin: "6px 0 16px" }}>Debt Relief Call</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#4a5568", fontSize: 15, marginBottom: 10 }}>
        <span aria-hidden>🕐</span> 30 min
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#4a5568", fontSize: 15, marginBottom: 10 }}>
        <span aria-hidden>📞</span> Phone call
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#4a5568", fontSize: 15, marginBottom: 18 }}>
        <span aria-hidden>🌎</span> Eastern Time (US)
      </div>
      <p style={{ fontSize: 14, color: "#4a5568", lineHeight: 1.6 }}>Pick a time that works for you and one of our specialists will call to walk through your debt relief options.</p>
    </div>
  );

  if (step === "done") {
    return (
      <div style={wrap}>
        <div style={{ ...cardBase, maxWidth: 640, display: "flex", flexWrap: "wrap" }}>
          {left}
          <div style={{ flex: 1, minWidth: 260, padding: 40, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e7f7ec", color: "#1a9e4b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 14 }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: ink, margin: "0 0 6px" }}>You&apos;re scheduled</h2>
            <p style={{ fontSize: 15, color: muted }}>{selectedLabel} (ET)</p>
            <p style={{ fontSize: 14, color: "#4a5568", marginTop: 10 }}>Thanks, {name}. A specialist will call you at that time.</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Calendar grid for the viewed month ---
  const calendar = view && (() => {
    const daysIn = new Date(view.y, view.m + 1, 0).getDate();
    const firstDow = new Date(Date.UTC(view.y, view.m, 1, 12)).getUTCDay();
    const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
    const canPrev = (() => { const now = new Date(); return view.y > now.getFullYear() || (view.y === now.getFullYear() && view.m > now.getMonth()); })();
    return (
      <div style={{ minWidth: 300 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: ink }}>{MONTHS[view.m]} {view.y}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => canPrev && setView({ y: view.m === 0 ? view.y - 1 : view.y, m: (view.m + 11) % 12 })} disabled={!canPrev} style={{ background: "none", border: 0, fontSize: 20, color: canPrev ? blue : "#c9cfdb", cursor: canPrev ? "pointer" : "default", padding: "0 6px" }}>‹</button>
            <button onClick={() => setView({ y: view.m === 11 ? view.y + 1 : view.y, m: (view.m + 1) % 12 })} style={{ background: "none", border: 0, fontSize: 20, color: blue, cursor: "pointer", padding: "0 6px" }}>›</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
          {DOW.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: muted }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const key = `${view.y}-${pad(view.m + 1)}-${pad(day)}`;
            const avail = byDate.has(key);
            const sel = date === key;
            return (
              <button key={i} disabled={!avail} onClick={() => { setDate(key); setSlot(null); }}
                style={{ aspectRatio: "1", borderRadius: "50%", border: 0, fontSize: 14, fontWeight: avail ? 700 : 400,
                  cursor: avail ? "pointer" : "default",
                  background: sel ? blue : avail ? "#eaf1ff" : "transparent",
                  color: sel ? "#fff" : avail ? blue : "#c2c8d4" }}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  })();

  const dateHeading = date ? new Date(times[0]?.iso ?? Date.now()).toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" }) : null;

  return (
    <div style={wrap}>
      <div style={{ ...cardBase, maxWidth: step === "details" ? 720 : 900, display: "flex", flexWrap: "wrap" }}>
        {left}
        <div style={{ flex: 1, minWidth: 300, padding: "24px 26px" }}>
          {step === "pick" && (
            <>
              <div style={{ fontSize: 19, fontWeight: 700, color: ink, marginBottom: 16 }}>Select a Date &amp; Time</div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {calendar}
                {date && (
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: ink, marginBottom: 10 }}>{dateHeading}</div>
                    <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
                      {times.map((t) => (
                        <button key={t.iso} onClick={() => { setSlot(t.iso); setStep("details"); }}
                          style={{ padding: "12px", borderRadius: 8, border: `1px solid ${slot === t.iso ? blue : "#cfd6e4"}`, background: "#fff", color: blue, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                          {t.timeLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!date && <div style={{ flex: 1, minWidth: 180, color: muted, fontSize: 14, alignSelf: "center", textAlign: "center" }}>Select a day to see available times.</div>}
              </div>
            </>
          )}

          {step === "details" && (
            <>
              <button onClick={() => setStep("pick")} style={{ background: "none", border: 0, color: blue, cursor: "pointer", fontSize: 14, fontWeight: 600, padding: 0, marginBottom: 12 }}>‹ Back</button>
              <div style={{ fontSize: 19, fontWeight: 700, color: ink, marginBottom: 4 }}>Enter Details</div>
              <div style={{ fontSize: 14, color: muted, marginBottom: 18 }}>🕐 {selectedLabel} (ET)</div>
              <label style={{ fontSize: 13, fontWeight: 700, color: ink }}>Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              <label style={{ fontSize: 13, fontWeight: 700, color: ink }}>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={inputStyle} />
              <label style={{ fontSize: 13, fontWeight: 700, color: ink }}>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" style={inputStyle} />
              {err && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 8 }}>{err}</div>}
              <button onClick={schedule} disabled={busy} style={{ marginTop: 8, background: blue, color: "#fff", border: 0, borderRadius: 22, padding: "11px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Scheduling..." : "Schedule Event"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid #cfd6e4", borderRadius: 6, padding: "10px 12px", fontSize: 14, margin: "5px 0 14px", boxSizing: "border-box", color: "#1a1a1a" };
