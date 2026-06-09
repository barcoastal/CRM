"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LeadContext {
  id: string;
  contactName: string;
  businessName: string;
  phone: string;
  email: string | null;
  status: string;
  totalDebtEst: number | null;
  numberOfLenders: number | null;
  industry: string | null;
  lastContactedAt: string | null;
  recentCalls: Array<{ id: string; startedAt: string; disposition: string | null; duration: number | null }>;
}

interface Props {
  five9Domain: string | null;
  defaultStation: string | null;
}

/**
 * Five9 Agent Desktop embedded via iframe. Left pane shows the lead
 * context auto-loaded by phone when Five9 posts a callConnected event;
 * right pane hosts the full Five9 Agent Desktop the rep already uses.
 *
 * Five9 publishes a postMessage API for the iframed Agent Desktop —
 * events arrive as { type: "five9.callConnected", payload: { ani, dnis, ... } }.
 */
export function Five9Client({ five9Domain, defaultStation: _defaultStation }: Props) {
  const [lead, setLead] = useState<LeadContext | null>(null);
  const [loadingLead, setLoadingLead] = useState(false);
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!five9Domain) return;
      if (!event.origin.includes(five9Domain) && !event.origin.includes("five9.com")) return;
      const data = event.data as { type?: string; payload?: Record<string, unknown> } | undefined;
      if (!data || typeof data !== "object") return;
      if (data.type === "five9.callConnected" || data.type === "callConnected") {
        const payload = data.payload ?? {};
        const phone =
          (payload.ani as string) ??
          (payload.dnis as string) ??
          (payload.phoneNumber as string) ??
          null;
        if (phone) void handlePhoneChange(phone);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [five9Domain]);

  // Screen-pop from THIS CRM: the embedded Five9 desktop uses its own (Salesforce)
  // connector and doesn't postMessage us, so poll our backend for the agent's
  // current active call (written by the Five9 webhook) and load the lead here.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/dialer/active-call");
        if (!res.ok) return;
        const data = (await res.json()) as { active?: boolean; phone?: string };
        if (!data.active || !data.phone) return;
        const last10 = data.phone.replace(/[^0-9]/g, "").slice(-10);
        const cur = (currentPhone ?? "").replace(/[^0-9]/g, "").slice(-10);
        if (last10 && last10 !== cur) void handlePhoneChange(data.phone);
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhone]);

  async function handlePhoneChange(phone: string) {
    setCurrentPhone(phone);
    setLoadingLead(true);
    try {
      const last10 = phone.replace(/[^0-9]/g, "").slice(-10);
      const res = await fetch(`/api/leads/by-phone?phone=${encodeURIComponent(last10)}`);
      if (res.ok) {
        const data = await res.json();
        setLead(data ?? null);
      }
    } finally {
      setLoadingLead(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 12, padding: 12 }}>
      {/* Lead context — slim left sidebar */}
      <div>
        <article style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, padding: 16, minHeight: 600 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#3e3e3c", marginBottom: 12 }}>
            Lead Context
          </h2>
          {loadingLead && <div style={{ color: "#706e6b" }}>Loading lead…</div>}
          {!loadingLead && !lead && !currentPhone && (
            <div style={{ color: "#706e6b", padding: 24, textAlign: "center" }}>
              No active call. When Five9 connects a call, the matching lead loads here automatically.
            </div>
          )}
          {!loadingLead && !lead && currentPhone && (
            <QuickCreateLead phone={currentPhone} onCreated={() => void handlePhoneChange(currentPhone)} />
          )}
          {lead && <LeadCard key={lead.id} lead={lead} onSaved={(updated) => setLead(updated)} />}
        </article>
      </div>

      {/* Five9 dialer — right: embedded Five9 Agent Desktop (its real browser
          softphone). The agent logs in here; audio runs through Five9's
          softphone (extension + local service). We screen-pop the lead on the
          left from its postMessage callConnected events. */}
      <div>
        <iframe
          src={"https://app-atl.five9.com/clients/agent/main.html?role=Agent"}
          title="Five9 Agent Desktop"
          allow="microphone; autoplay; clipboard-read; clipboard-write"
          style={{ width: "100%", height: "calc(100vh - 130px)", minHeight: 600, border: "1px solid #d8dde6", borderRadius: 4, background: "#fff" }}
        />
      </div>
    </div>
  );
}

/**
 * Inline quick-create for a closer on a live call: the dialed number matched no
 * lead, so capture a new one (phone pre-filled) without leaving the call. On
 * save it reloads via by-phone so the LeadCard pops immediately.
 */
function QuickCreateLead({ phone, onCreated }: { phone: string; onCreated: () => void }) {
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phoneVal, setPhoneVal] = useState(phone);
  const [email, setEmail] = useState("");
  const [totalDebtEst, setTotalDebtEst] = useState("");
  const [numberOfLenders, setNumberOfLenders] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the phone if the active call changes while the form is open.
  useEffect(() => setPhoneVal(phone), [phone]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!contactName.trim() || !phoneVal.trim()) {
      setError("Contact name and phone are required.");
      return;
    }
    setSaving(true);
    try {
      const debtNum = Number(totalDebtEst.replace(/[^0-9.]/g, ""));
      const lendersNum = Number(numberOfLenders.replace(/[^0-9]/g, ""));
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: contactName.trim(),
          businessName: businessName.trim() || contactName.trim(),
          phone: phoneVal.trim(),
          email: email.trim(),
          totalDebtEst: debtNum > 0 ? debtNum : "",
          numberOfLenders: numberOfLenders.trim() === "" || Number.isNaN(lendersNum) ? "" : lendersNum,
          notes: notes.trim(),
          source: "COLD_CALL",
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? "Failed to create lead");
        return;
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #d8dde6",
    borderRadius: 4,
    fontSize: 13,
    marginTop: 2,
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "#706e6b", fontWeight: 600 };

  return (
    <div>
      <div style={{ color: "#c23934", fontSize: 13, marginBottom: 12 }}>
        No lead found for <strong>{phone}</strong> — create one:
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={labelStyle}>
          Contact name *
          <input style={inputStyle} value={contactName} onChange={(e) => setContactName(e.target.value)} autoFocus placeholder="First Last" />
        </label>
        <label style={labelStyle}>
          Business name
          <input style={inputStyle} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="(defaults to contact name)" />
        </label>
        <label style={labelStyle}>
          Phone *
          <input style={inputStyle} value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} />
        </label>
        <label style={labelStyle}>
          Email
          <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={labelStyle}>
            Real debt amount
            <input style={inputStyle} value={totalDebtEst} onChange={(e) => setTotalDebtEst(e.target.value)} placeholder="$" inputMode="numeric" />
          </label>
          <label style={labelStyle}>
            # of lenders
            <input style={inputStyle} value={numberOfLenders} onChange={(e) => setNumberOfLenders(e.target.value)} placeholder="0" inputMode="numeric" />
          </label>
        </div>
        <label style={labelStyle}>
          Notes
          <textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did they say?" />
        </label>
        {error && <div style={{ color: "#c23934", fontSize: 12 }}>{error}</div>}
        <button
          type="submit"
          disabled={saving}
          style={{
            background: saving ? "#9bb8e0" : "#0070d2",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: saving ? "default" : "pointer",
            marginTop: 4,
          }}
        >
          {saving ? "Creating…" : "Create lead"}
        </button>
      </form>
    </div>
  );
}

/**
 * Live lead card — editable so the opener can verify/correct the lead on the
 * call: contact name, business name, email, the real debt amount, and the
 * number of lenders. Saves via PATCH /api/leads/[id]. Keyed by lead.id in the
 * parent so it reseeds for each new call.
 */
function LeadCard({ lead, onSaved }: { lead: LeadContext; onSaved: (l: LeadContext) => void }) {
  const debtStr = (v: number | null) => (v != null ? String(v) : "");
  const [contactName, setContactName] = useState(lead.contactName);
  const [businessName, setBusinessName] = useState(lead.businessName);
  const [email, setEmail] = useState(lead.email ?? "");
  const [totalDebtEst, setTotalDebtEst] = useState(debtStr(lead.totalDebtEst));
  const [numberOfLenders, setNumberOfLenders] = useState(debtStr(lead.numberOfLenders));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    contactName !== lead.contactName ||
    businessName !== lead.businessName ||
    email !== (lead.email ?? "") ||
    totalDebtEst !== debtStr(lead.totalDebtEst) ||
    numberOfLenders !== debtStr(lead.numberOfLenders);

  async function save() {
    setError(null);
    if (!contactName.trim()) {
      setError("Contact name is required.");
      return;
    }
    setSaving(true);
    try {
      const debtNum = Number(totalDebtEst.replace(/[^0-9.]/g, ""));
      const lendersNum = Number(numberOfLenders.replace(/[^0-9]/g, ""));
      const newDebt = debtNum > 0 ? debtNum : null;
      const newLenders = numberOfLenders.trim() === "" || Number.isNaN(lendersNum) ? null : lendersNum;
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: contactName.trim(),
          businessName: businessName.trim() || contactName.trim(),
          email: email.trim(),
          totalDebtEst: newDebt ?? "",
          numberOfLenders: newLenders ?? "",
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? "Failed to save");
        return;
      }
      onSaved({
        ...lead,
        contactName: contactName.trim(),
        businessName: businessName.trim() || contactName.trim(),
        email: email.trim() || null,
        totalDebtEst: newDebt,
        numberOfLenders: newLenders,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", border: "1px solid #d8dde6", borderRadius: 4, fontSize: 13, marginTop: 2 };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "#706e6b", fontWeight: 600 };

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{lead.contactName || "New lead"}</h3>
        <div style={{ color: "#706e6b", fontSize: 12 }}>
          {lead.phone} · {lead.status}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#0070d2", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, margin: "8px 0 6px" }}>
        Verify with caller
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={labelStyle}>
          Contact name *
          <input style={inputStyle} value={contactName} onChange={(e) => { setContactName(e.target.value); setSaved(false); }} />
        </label>
        <label style={labelStyle}>
          Business name
          <input style={inputStyle} value={businessName} onChange={(e) => { setBusinessName(e.target.value); setSaved(false); }} />
        </label>
        <label style={labelStyle}>
          Email
          <input style={inputStyle} value={email} onChange={(e) => { setEmail(e.target.value); setSaved(false); }} placeholder="name@company.com" />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={labelStyle}>
            Real debt amount
            <input style={inputStyle} value={totalDebtEst} onChange={(e) => { setTotalDebtEst(e.target.value); setSaved(false); }} placeholder="$" inputMode="numeric" />
          </label>
          <label style={labelStyle}>
            # of lenders
            <input style={inputStyle} value={numberOfLenders} onChange={(e) => { setNumberOfLenders(e.target.value); setSaved(false); }} placeholder="0" inputMode="numeric" />
          </label>
        </div>
        {error && <div style={{ color: "#c23934", fontSize: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            style={{
              background: saving || !dirty ? "#9bb8e0" : "#0070d2",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: saving || !dirty ? "default" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && !dirty && <span style={{ color: "#2e844a", fontSize: 12, fontWeight: 600 }}>Saved ✓</span>}
          <Link href={`/leads/${lead.id}`} target="_blank" style={{ marginLeft: "auto", color: "#0070d2", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            Open full lead ↗
          </Link>
        </div>
      </div>

      {(lead.industry || lead.lastContactedAt) && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #ecebea" }}>
          <Grid
            cells={[
              ["Industry", lead.industry ?? "—"],
              ["Last contact", lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString() : "—"],
            ]}
          />
        </div>
      )}

      {lead.recentCalls.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Recent Calls</h4>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ecebea" }}>
                <th style={{ textAlign: "left", padding: "4px 0" }}>When</th>
                <th style={{ textAlign: "left", padding: "4px 0" }}>Disposition</th>
                <th style={{ textAlign: "right", padding: "4px 0" }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {lead.recentCalls.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                  <td style={{ padding: "4px 0" }}>{new Date(c.startedAt).toLocaleString()}</td>
                  <td style={{ padding: "4px 0" }}>{c.disposition ?? "—"}</td>
                  <td style={{ padding: "4px 0", textAlign: "right" }}>
                    {c.duration ? `${Math.floor(c.duration / 60)}:${String(c.duration % 60).padStart(2, "0")}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Grid({ cells }: { cells: [string, string][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", fontSize: 13 }}>
      {cells.map(([k, v]) => (
        <div key={k}>
          <div style={{ color: "#706e6b", fontSize: 11, marginBottom: 2 }}>{k}</div>
          <div style={{ color: "#080707", fontWeight: 600 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}
