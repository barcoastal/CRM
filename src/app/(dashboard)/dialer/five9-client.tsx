"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DispositionModal } from "@/components/leads/disposition-modal";
import { LEAD_STATUSES, STAGE_TO_SUB_DISPOSITIONS, type LeadStatusV2 } from "@/lib/sf-canonical";
import { CallTranscriber } from "./call-transcriber";
import { MyAssignment } from "@/components/dialer/my-assignment";

const FIVE9_AGENT_URL = "https://app-atl.five9.com/clients/agent/main.html?role=Agent";

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
const last10 = (p: string | null | undefined) => (p ?? "").replace(/[^0-9]/g, "").slice(-10);

export function Five9Client({ five9Domain, defaultStation: _defaultStation }: Props) {
  const [lead, setLead] = useState<LeadContext | null>(null);
  const [loadingLead, setLoadingLead] = useState(false);
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);
  const [wrapped, setWrapped] = useState(false); // disposition saved → waiting for next call
  // Run Five9 in its own window instead of the embedded iframe. The iframe loses
  // its Five9 session on call-connect (browser blocks the cookie in a cross-site
  // frame); a real window keeps it logged in. Screen-pop here is unaffected (it
  // reads the server-side supervisor feed, not the iframe).
  const [poppedOut, setPoppedOut] = useState(false);
  useEffect(() => {
    try { setPoppedOut(localStorage.getItem("five9PoppedOut") === "1"); } catch {}
  }, []);
  function openFive9Window() {
    window.open(FIVE9_AGENT_URL, "five9agent", "width=1240,height=840");
    setPoppedOut(true);
    try { localStorage.setItem("five9PoppedOut", "1"); } catch {}
  }
  function useEmbeddedFive9() {
    setPoppedOut(false);
    try { localStorage.setItem("five9PoppedOut", "0"); } catch {}
  }

  // Refs so the polling interval always sees the latest call identity without
  // re-subscribing. A call is identified by onCallSince (its start timestamp).
  const currentPhoneRef = useRef<string | null>(null);
  const callSinceRef = useRef<number | null>(null);
  const dispositionedSinceRef = useRef<number | null>(null); // call we already closed

  async function popLead(phone: string, since: number | null) {
    currentPhoneRef.current = phone;
    callSinceRef.current = since;
    setCurrentPhone(phone);
    setWrapped(false);
    setLoadingLead(true);
    try {
      const res = await fetch(`/api/leads/by-phone?phone=${encodeURIComponent(last10(phone))}`);
      if (res.ok) setLead((await res.json()) ?? null);
    } finally {
      setLoadingLead(false);
    }
  }

  function clearPane(opts?: { wrapped?: boolean }) {
    currentPhoneRef.current = null;
    callSinceRef.current = null;
    setCurrentPhone(null);
    setLead(null);
    if (opts?.wrapped) setWrapped(true);
  }

  // Called when a disposition is saved: close the current call and wait for the
  // next one. Remember this call's id so the still-connected call won't re-pop.
  function handleDispositioned() {
    dispositionedSinceRef.current = callSinceRef.current;
    clearPane({ wrapped: true });
  }

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
        if (phone) void popLead(phone, null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [five9Domain]);

  // Screen-pop: poll the agent's current active call from the supervisor feed.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/dialer/active-call");
        if (!res.ok) return;
        const data = (await res.json()) as { active?: boolean; phone?: string; onCallSince?: number };
        if (!data.active || !data.phone) {
          // Call ended → reset to the waiting state; a new call may pop again.
          if (currentPhoneRef.current) clearPane();
          dispositionedSinceRef.current = null;
          return;
        }
        const since = typeof data.onCallSince === "number" ? data.onCallSince : null;
        // Suppress the call we already dispositioned (it stays "active" until hangup).
        if (since !== null && since === dispositionedSinceRef.current) return;
        const isNewCall =
          last10(data.phone) !== last10(currentPhoneRef.current) ||
          (since !== null && since !== callSinceRef.current);
        if (isNewCall) void popLead(data.phone, since);
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sf-dialer-grid" style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr) 320px", gap: 12, padding: 12 }}>
      {/* Lead context — slim left sidebar */}
      <div>
        <article style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, padding: 16, minHeight: 600 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#444444", margin: 0 }}>Lead Context</h2>
            <Link href="/dialer/floor" style={{ color: "#0176d3", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              Live floor ↗
            </Link>
          </div>
          {loadingLead && <div style={{ color: "#747474" }}>Loading lead…</div>}
          {!loadingLead && !lead && !currentPhone && wrapped && (
            <div style={{ color: "#2e844a", padding: 24, textAlign: "center" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Disposition saved ✓</div>
              <div style={{ color: "#747474" }}>Waiting for the next call…</div>
            </div>
          )}
          {!loadingLead && !lead && !currentPhone && !wrapped && (
            <div style={{ color: "#747474", padding: 24, textAlign: "center" }}>
              No active call. When Five9 connects a call, the matching lead loads here automatically.
            </div>
          )}
          {!loadingLead && !lead && currentPhone && (
            <QuickCreateLead phone={currentPhone} onCreated={() => void popLead(currentPhone, callSinceRef.current)} />
          )}
          {lead && (
            <LeadCard
              key={lead.id}
              lead={lead}
              onSaved={(updated) => setLead(updated)}
              onDispositioned={handleDispositioned}
            />
          )}
        </article>
        <CallTranscriber />
      </div>

      {/* Five9 dialer — right: embedded Five9 Agent Desktop (its real browser
          softphone). The agent logs in here; audio runs through Five9's
          softphone (extension + local service). We screen-pop the lead on the
          left from its postMessage callConnected events. */}
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
          <button
            onClick={openFive9Window}
            style={{ background: "#0176d3", color: "#fff", border: 0, padding: "6px 14px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Open Five9 in its own window
          </button>
          {poppedOut && (
            <button
              onClick={useEmbeddedFive9}
              style={{ background: "#fff", color: "#0176d3", border: "1px solid #c9c9c9", padding: "6px 14px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Use embedded here
            </button>
          )}
        </div>
        {poppedOut ? (
          <div
            style={{
              border: "1px solid #c9c9c9", borderRadius: 4, background: "#fff",
              height: "calc(100vh - 170px)", minHeight: 560, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, gap: 12, color: "#444444",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Five9 is running in its own window</div>
            <div style={{ fontSize: 13, color: "#747474", maxWidth: 420 }}>
              Keeping the dialer in its own window stops Five9 from logging you out when a call connects.
              The matching lead still loads here automatically while you talk.
            </div>
            <button
              onClick={openFive9Window}
              style={{ background: "#0176d3", color: "#fff", border: 0, padding: "8px 18px", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Reopen the Five9 window
            </button>
          </div>
        ) : (
          <iframe
            src={FIVE9_AGENT_URL}
            title="Five9 Agent Desktop"
            allow="microphone; autoplay; clipboard-read; clipboard-write"
            style={{ width: "100%", height: "calc(100vh - 170px)", minHeight: 600, border: "1px solid #c9c9c9", borderRadius: 4, background: "#fff" }}
          />
        )}
      </div>

      {/* Fronter sees only the manager's assignment (not the open-closer list). */}
      <div>
        <MyAssignment />
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
    border: "1px solid #c9c9c9",
    borderRadius: 4,
    fontSize: 13,
    marginTop: 2,
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "#747474", fontWeight: 600 };

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
            background: saving ? "#9bb8e0" : "#0176d3",
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
function LeadCard({ lead, onSaved, onDispositioned }: { lead: LeadContext; onSaved: (l: LeadContext) => void; onDispositioned: () => void }) {
  const debtStr = (v: number | null) => (v != null ? String(v) : "");
  const [contactName, setContactName] = useState(lead.contactName);
  const [businessName, setBusinessName] = useState(lead.businessName);
  const [email, setEmail] = useState(lead.email ?? "");
  const [totalDebtEst, setTotalDebtEst] = useState(debtStr(lead.totalDebtEst));
  const [numberOfLenders, setNumberOfLenders] = useState(debtStr(lead.numberOfLenders));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispOpen, setDispOpen] = useState(false);

  // On an active call the opener is "Working Lead"; fall back to it if the raw
  // status isn't one of the canonical V2 stages.
  const currentStage: LeadStatusV2 = (LEAD_STATUSES as readonly string[]).includes(lead.status)
    ? (lead.status as LeadStatusV2)
    : "Working Lead";

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

  const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13, marginTop: 2 };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "#747474", fontWeight: 600 };

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{lead.contactName || "New lead"}</h3>
        <div style={{ color: "#747474", fontSize: 12 }}>
          {lead.phone} · {lead.status}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#0176d3", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, margin: "8px 0 6px" }}>
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
              background: saving || !dirty ? "#9bb8e0" : "#0176d3",
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
          <button
            type="button"
            onClick={() => setDispOpen(true)}
            style={{
              background: "#fff",
              color: "#0176d3",
              padding: "8px 16px",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid #0176d3",
              cursor: "pointer",
            }}
          >
            Disposition
          </button>
          {saved && !dirty && <span style={{ color: "#2e844a", fontSize: 12, fontWeight: 600 }}>Saved ✓</span>}
          <Link href={`/leads/${lead.id}`} target="_blank" style={{ marginLeft: "auto", color: "#0176d3", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            Open full lead ↗
          </Link>
        </div>
      </div>

      <DispositionModal
        endpoint={`/api/leads/${lead.id}/disposition`}
        stages={LEAD_STATUSES}
        subDispositionsByStage={STAGE_TO_SUB_DISPOSITIONS}
        currentStage={currentStage}
        open={dispOpen}
        onClose={() => setDispOpen(false)}
        onSaved={onDispositioned}
      />

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
          <div style={{ color: "#747474", fontSize: 11, marginBottom: 2 }}>{k}</div>
          <div style={{ color: "#181818", fontWeight: 600 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}
