"use client";

import { useEffect, useMemo, useState } from "react";

interface Slot { iso: string; dateKey: string; timeLabel: string; label: string }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const pad = (n: number) => String(n).padStart(2, "0");

const BLUE = "#3052ff";
const INK = "#0d121c";
const MUTED = "#5b6472";

const COUNTRIES = [
  { iso: "US", flag: "🇺🇸", dial: "+1" },
  { iso: "CA", flag: "🇨🇦", dial: "+1" },
  { iso: "GB", flag: "🇬🇧", dial: "+44" },
  { iso: "RO", flag: "🇷🇴", dial: "+40" },
  { iso: "AU", flag: "🇦🇺", dial: "+61" },
  { iso: "IL", flag: "🇮🇱", dial: "+972" },
];

function PhoneField({ value, onChange }: { value: { iso: string; number: string }; onChange: (v: { iso: string; number: string }) => void }) {
  const country = COUNTRIES.find((c) => c.iso === value.iso) ?? COUNTRIES[0];
  return (
    <div style={{ display: "flex", alignItems: "stretch", border: "1px solid #cfd6e4", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderRight: "1px solid #e6e8ef", background: "#fafbfe" }}>
        <select value={value.iso} onChange={(e) => onChange({ ...value, iso: e.target.value })}
          style={{ border: 0, background: "transparent", fontSize: 15, cursor: "pointer", appearance: "none", padding: "0 2px" }}>
          {COUNTRIES.map((c) => <option key={c.iso} value={c.iso}>{c.flag} {c.dial}</option>)}
        </select>
      </div>
      <input value={value.number} onChange={(e) => onChange({ ...value, number: e.target.value })}
        placeholder={country.dial} inputMode="tel"
        style={{ flex: 1, border: 0, padding: "11px 12px", fontSize: 14, outline: "none", color: INK }} />
    </div>
  );
}

export default function GenericBookPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "details" | "done">("pick");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<{ iso: string; number: string }>({ iso: "US", number: "" });
  const [sms, setSms] = useState<{ iso: string; number: string }>({ iso: "US", number: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/book").then((r) => (r.ok ? r.json() : { slots: [] })).then((d) => {
      const ss: Slot[] = d.slots ?? [];
      setSlots(ss);
      if (ss[0]) { const [y, m] = ss[0].dateKey.split("-").map(Number); setView({ y, m: m - 1 }); }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const nm = (q.get("name") ?? [q.get("first"), q.get("last")].filter(Boolean).join(" ")).trim();
    if (nm) setName(nm);
    const em = q.get("email"); if (em) setEmail(em.trim());
    const ph = q.get("phone"); if (ph) { const n = ph.replace(/^\+1/, "").trim(); setPhone({ iso: "US", number: n }); setSms({ iso: "US", number: n }); }
  }, []);

  const byDate = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) { const a = m.get(s.dateKey) ?? []; a.push(s); m.set(s.dateKey, a); }
    return m;
  }, [slots]);

  const times = date ? byDate.get(date) ?? [] : [];
  const selected = slot ? slots.find((s) => s.iso === slot) : null;

  // "00:30 - 00:45, Thursday, August 27, 2026" style
  const meetingWhen = selected ? (() => {
    const start = new Date(selected.iso);
    const end = new Date(start.getTime() + 15 * 60000);
    const t = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
    const day = start.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", year: "numeric" });
    return `${t(start)} - ${t(end)}, ${day}`;
  })() : null;

  async function schedule() {
    setErr(null);
    if (!name.trim()) return setErr("Please enter your name.");
    if (!email.trim()) return setErr("Please enter your email.");
    if (!phone.number.trim()) return setErr("Please enter your phone number.");
    setBusy(true);
    try {
      const dial = (COUNTRIES.find((c) => c.iso === phone.iso) ?? COUNTRIES[0]).dial;
      const smsDial = (COUNTRIES.find((c) => c.iso === sms.iso) ?? COUNTRIES[0]).dial;
      const res = await fetch("/api/book", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email,
          phone: `${dial} ${phone.number}`.trim(),
          smsPhone: sms.number.trim() ? `${smsDial} ${sms.number}`.trim() : null,
          slot,
        }),
      });
      if (res.ok) setStep("done");
      else setErr((await res.json().catch(() => ({}))).error ?? "Could not book.");
    } finally { setBusy(false); }
  }

  const wrap: React.CSSProperties = { minHeight: "100vh", background: "#f7f8fb", fontFamily: "'Inter',-apple-system,Segoe UI,Roboto,Arial,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" };
  const card: React.CSSProperties = { background: "#fff", borderRadius: 10, boxShadow: "0 1px 8px rgba(13,18,28,0.10)", border: "1px solid #e6e8ef", overflow: "hidden", width: "100%", display: "flex", flexWrap: "wrap" };
  const metaRow = (icon: React.ReactNode, text: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#3d4653", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
      <span style={{ color: MUTED, display: "inline-flex", width: 18 }} aria-hidden>{icon}</span>{text}
    </div>
  );

  // shared left/brand panel
  const left = (showBack: boolean) => (
    <div style={{ position: "relative", padding: "26px 28px", borderRight: "1px solid #eceef3", width: 360, maxWidth: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      {showBack && (
        <button onClick={() => setStep("pick")} aria-label="Back"
          style={{ position: "absolute", top: 20, left: 24, width: 34, height: 34, borderRadius: "50%", border: `1px solid ${BLUE}`, background: "#fff", color: BLUE, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>←</button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/coastal-debt-logo.svg" alt="Coastal Debt" style={{ height: 30, alignSelf: "center", marginTop: showBack ? 8 : 0, marginBottom: 22 }} />
      <div style={{ borderTop: "1px solid #eceef3", paddingTop: 22 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/chevron.svg" alt="" style={{ height: 34, marginBottom: 16 }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: MUTED, marginBottom: 6 }}>Coastal Debt Consultations</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: INK, margin: "0 0 20px", lineHeight: 1.2 }}>Save $ on Your MCA Payments</h1>
        {metaRow("🕐", "15 min")}
        {metaRow("📞", "Phone call")}
        {meetingWhen && metaRow("📅", meetingWhen)}
        {metaRow("🌎", "Eastern Time (US)")}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 24, display: "flex", gap: 20 }}>
        <a href="#" style={{ color: BLUE, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Cookie settings</a>
        <a href="#" style={{ color: BLUE, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>Privacy Policy</a>
      </div>
    </div>
  );

  if (step === "done") {
    return (
      <div style={wrap}>
        <div style={{ ...card, maxWidth: 820, minHeight: 460 }}>
          {left(false)}
          <div style={{ flex: 1, minWidth: 280, padding: 40, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e7f7ec", color: "#1a9e4b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 14 }}>✓</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: "0 0 6px" }}>You&apos;re scheduled</h2>
            <p style={{ fontSize: 15, color: MUTED }}>{meetingWhen}</p>
            <p style={{ fontSize: 14, color: "#3d4653", marginTop: 10 }}>Thanks, {name}. A specialist will call you at that time.</p>
          </div>
        </div>
      </div>
    );
  }

  const calendar = view && (() => {
    const daysIn = new Date(view.y, view.m + 1, 0).getDate();
    const firstDow = new Date(Date.UTC(view.y, view.m, 1, 12)).getUTCDay();
    const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
    const canPrev = (() => { const now = new Date(); return view.y > now.getFullYear() || (view.y === now.getFullYear() && view.m > now.getMonth()); })();
    return (
      <div style={{ minWidth: 300 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>{MONTHS[view.m]} {view.y}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => canPrev && setView({ y: view.m === 0 ? view.y - 1 : view.y, m: (view.m + 11) % 12 })} disabled={!canPrev} style={{ background: "none", border: 0, fontSize: 20, color: canPrev ? BLUE : "#c9cfdb", cursor: canPrev ? "pointer" : "default", padding: "0 6px" }}>‹</button>
            <button onClick={() => setView({ y: view.m === 11 ? view.y + 1 : view.y, m: (view.m + 1) % 12 })} style={{ background: "none", border: 0, fontSize: 20, color: BLUE, cursor: "pointer", padding: "0 6px" }}>›</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
          {DOW.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: MUTED }}>{d}</div>)}
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
                  background: sel ? BLUE : avail ? "#e9edff" : "transparent",
                  color: sel ? "#fff" : avail ? BLUE : "#c2c8d4" }}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  })();

  const dateHeading = date ? new Date(times[0]?.iso ?? Date.now()).toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" }) : null;
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: INK, display: "block", marginBottom: 5 };
  const input: React.CSSProperties = { width: "100%", border: "1px solid #cfd6e4", borderRadius: 6, padding: "11px 12px", fontSize: 14, boxSizing: "border-box", color: INK, outline: "none" };

  return (
    <div style={wrap}>
      <div style={{ ...card, maxWidth: step === "details" ? 900 : 940, minHeight: 460 }}>
        {left(step === "details")}
        <div style={{ flex: 1, minWidth: 300, padding: "26px 30px" }}>
          {step === "pick" && (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: INK, marginBottom: 16 }}>Select a Date &amp; Time</div>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                {calendar}
                {date ? (
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 10 }}>{dateHeading}</div>
                    <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
                      {times.map((t) => (
                        <button key={t.iso} onClick={() => { setSlot(t.iso); setStep("details"); }}
                          style={{ padding: "12px", borderRadius: 6, border: `1px solid ${BLUE}`, background: "#fff", color: BLUE, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                          {t.timeLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : <div style={{ flex: 1, minWidth: 180, color: MUTED, fontSize: 14, alignSelf: "center", textAlign: "center" }}>Select a day to see available times.</div>}
              </div>
            </>
          )}

          {step === "details" && (
            <div style={{ maxWidth: 420 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: INK, marginBottom: 18 }}>Enter Details</div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Name <span style={{ color: BLUE }}>*</span></label>
                <input value={name} onChange={(e) => setName(e.target.value)} style={input} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Email <span style={{ color: BLUE }}>*</span></label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={input} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={label}>Phone number <span style={{ color: BLUE }}>*</span></label>
                <PhoneField value={phone} onChange={setPhone} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={label}>Send text messages to</label>
                <PhoneField value={sms} onChange={setSms} />
              </div>
              <p style={{ fontSize: 12.5, color: "#3d4653", lineHeight: 1.5, marginBottom: 16 }}>
                By proceeding, you confirm that you have read and agree to{" "}
                <a href="#" style={{ color: BLUE, fontWeight: 600, textDecoration: "none" }}>Coastal Debt&apos;s Terms</a> and{" "}
                <a href="#" style={{ color: BLUE, fontWeight: 600, textDecoration: "none" }}>Privacy Notice</a>.
              </p>
              {err && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{err}</div>}
              <button onClick={schedule} disabled={busy}
                style={{ background: BLUE, color: "#fff", border: 0, borderRadius: 22, padding: "11px 26px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? "Scheduling..." : "Schedule Event"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
