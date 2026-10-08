"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DispositionModal } from "@/components/leads/disposition-modal";
import { BRANDS, LEAD_STATUSES, STAGE_TO_SUB_DISPOSITIONS, type LeadStatusV2 } from "@/lib/sf-canonical";
import { CallTranscriber } from "./call-transcriber";
import { Five9ToolkitBridge } from "@/components/dialer/five9-toolkit-bridge";

const FIVE9_AGENT_URL = "https://app-atl.five9.com/clients/agent/main.html?role=Agent";

interface LeadContext {
  id: string;
  sfId: string | null;
  contactName: string;
  businessName: string;
  phone: string;
  email: string | null;
  status: string;
  brand: string | null;
  source: string;
  debtRange: string | null;
  createdAt: string;
  totalDebtEst: number | null;
  numberOfLenders: number | null;
  industry: string | null;
  lastContactedAt: string | null;
  firstName: string | null;
  lastName: string | null;
  alternateEmail: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  mobilePhone: string | null;
  workPhone: string | null;
  ein: string | null;
  utmTerm: string | null;
  comments: string | null;
  hasCalendlyEvent: boolean | null;
  recentCalls: Array<{ id: string; startedAt: string; disposition: string | null; duration: number | null }>;
}

interface Props {
  five9Domain: string | null;
  defaultStation: string | null;
  frameOnly?: boolean;
  initialPhone?: string | null;
  userId?: string;
  pilotEligible?: boolean;
  toolkitMode?: boolean;
  expectedFive9Login?: string;
}

/**
 * CRM lead context beside Five9. The opt-in Toolkit view receives supported
 * call events from Five9's CRM SDK. The standard Agent Desktop Plus view can
 * use a dedicated supervisor feed when one is configured.
 */
const last10 = (p: string | null | undefined) => (p ?? "").replace(/[^0-9]/g, "").slice(-10);

export function Five9Client({ five9Domain, defaultStation: _defaultStation, frameOnly = false, initialPhone = null, userId, pilotEligible = false, toolkitMode = false, expectedFive9Login = "" }: Props) {
  const [lead, setLead] = useState<LeadContext | null>(null);
  const [matches, setMatches] = useState<LeadContext[]>([]);
  const [loadingLead, setLoadingLead] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);
  const [activeUnmatched, setActiveUnmatched] = useState(false);
  const [wrapped, setWrapped] = useState(false); // disposition saved → waiting for next call
  const [phoneQuery, setPhoneQuery] = useState("");
  // The standard Agent Desktop Plus iframe can lose its session when the
  // browser blocks cross-site cookies. The pop-out keeps Five9 top-level.
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
  const toolkitCallIdRef = useRef<string | null>(null);

  async function popLead(phone: string, since: number | null) {
    currentPhoneRef.current = phone;
    callSinceRef.current = since;
    setCurrentPhone(phone);
    setWrapped(false);
    setLoadingLead(true);
    setLead(null);
    setMatches([]);
    setLookupError(null);
    try {
      const res = await fetch(`/api/leads/by-phone?phone=${encodeURIComponent(last10(phone))}`);
      if (!res.ok) {
        setLookupError("Could not load this lead. Check your CRM access and try again.");
        return;
      }
      if (currentPhoneRef.current === phone && callSinceRef.current === since) {
        const data = await res.json() as { leads: LeadContext[] };
        const found = Array.isArray(data.leads) ? data.leads : [];
        setMatches(found);
        setLead(found[0] ?? null);
      }
    } catch {
      setLookupError("Could not reach the CRM. Please try again.");
    } finally {
      setLoadingLead(false);
    }
  }

  function clearPane(opts?: { wrapped?: boolean }) {
    currentPhoneRef.current = null;
    callSinceRef.current = null;
    setCurrentPhone(null);
    setLead(null);
    setMatches([]);
    setLookupError(null);
    if (opts?.wrapped) setWrapped(true);
  }

  // Called when a disposition is saved: close the current call and wait for the
  // next one. Remember this call's id so the still-connected call won't re-pop.
  function handleDispositioned() {
    dispositionedSinceRef.current = callSinceRef.current;
    clearPane({ wrapped: true });
  }

  function handleLeadSaved(updated: LeadContext) {
    setLead(updated);
    setMatches(previous => previous.map(item => item.id === updated.id ? updated : item));
  }

  useEffect(() => {
    if (frameOnly && initialPhone) void popLead(initialPhone, null);
  }, [frameOnly, initialPhone]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!five9Domain || toolkitMode) return;
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
  }, [five9Domain, toolkitMode]);

  // Screen-pop: poll the agent's current active call from the supervisor feed.
  useEffect(() => {
    // Five9's connector supplies the contact number directly in frame mode.
    // Polling the supervisor feed would clear it when that feed is unavailable.
    if (frameOnly || toolkitMode) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/dialer/active-call");
        if (!res.ok) return;
        const data = (await res.json()) as { active?: boolean; phone?: string; onCallSince?: number };
        if (!data.active || !data.phone) {
          // Call ended → reset to the waiting state; a new call may pop again.
          if (currentPhoneRef.current) clearPane();
          setActiveUnmatched(!!data.active);
          if (!data.active) dispositionedSinceRef.current = null;
          return;
        }
        setActiveUnmatched(false);
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
  }, [frameOnly, initialPhone, toolkitMode]);

  if (frameOnly) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f5f8", padding: 12, color: "#181818" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div>
            <strong style={{ fontSize: 15 }}>Coastal CRM</strong>
            <div style={{ color: "#64748b", fontSize: 12 }}>Opener lead workspace</div>
          </div>
          <Link href="/leads" target="_blank" style={{ color: "#0176d3", fontSize: 12, fontWeight: 600 }}>
            All leads ↗
          </Link>
        </header>
        <section style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 8, padding: 14 }}>
          <form onSubmit={event => { event.preventDefault(); if (last10(phoneQuery).length >= 7) void popLead(phoneQuery, null); }} style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input aria-label="Find lead by phone" type="tel" placeholder="Find lead by phone" value={phoneQuery} onChange={event => setPhoneQuery(event.target.value)} style={{ flex: 1, minWidth: 0, border: "1px solid #c9c9c9", borderRadius: 4, padding: "7px 9px" }} />
            <button type="submit" style={{ border: 0, borderRadius: 4, background: "#0176d3", color: "#fff", padding: "7px 10px", fontWeight: 600 }}>Find</button>
          </form>
          {loadingLead && <p style={{ color: "#64748b" }}>Loading current lead…</p>}
          {!loadingLead && !lead && !currentPhone && (
            <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
              {activeUnmatched ? "A Five9 call is active, but no accessible CRM lead matched its contact. Check the lead assignment and phone number." : wrapped ? "Disposition saved. Waiting for the next call…" : "Waiting for a Five9 call. The matching CRM lead will open here automatically."}
            </p>
          )}
          {lookupError && <p role="alert" style={{ color: "#ba1a1a", fontSize: 12 }}>{lookupError}</p>}
          {matches.length > 0 && <MatchSelector matches={matches} selectedId={lead?.id ?? null} onSelect={setLead} />}
          {!loadingLead && !lookupError && !lead && currentPhone && (
            <QuickCreateLead phone={currentPhone} assignedToId={userId} onCreated={() => void popLead(currentPhone, callSinceRef.current)} />
          )}
          {lead && (
            <LeadCard key={lead.id} lead={lead} onSaved={handleLeadSaved} onDispositioned={handleDispositioned} />
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="sf-dialer-grid" style={{ display: "grid", gridTemplateColumns: "minmax(360px, 34%) minmax(0, 1fr)", gap: 12, padding: 12 }}>
      {/* Lead context */}
      <div>
        <article style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, padding: 16, minHeight: 600 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#444444", margin: 0 }}>Lead Context</h2>
            <Link href="/dialer/floor" style={{ color: "#0176d3", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
              Live floor ↗
            </Link>
          </div>
          {pilotEligible && toolkitMode && <div style={{ marginBottom: 12, fontSize: 12 }}>
            <Link href="/dialer" style={{ color: "#0176d3", fontWeight: 700 }}>
              Return to Agent Desktop Plus ↗
            </Link>
          </div>}
          <form onSubmit={event => { event.preventDefault(); if (last10(phoneQuery).length >= 7) void popLead(phoneQuery, null); }} style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input aria-label="Find lead by phone" type="tel" placeholder="Find lead by phone" value={phoneQuery} onChange={event => setPhoneQuery(event.target.value)} style={{ flex: 1, minWidth: 0, padding: "6px 8px", border: "1px solid #c9c9c9", borderRadius: 4 }} />
            <button type="submit" style={{ border: 0, borderRadius: 4, background: "#0176d3", color: "#fff", padding: "6px 10px", fontWeight: 700 }}>Find</button>
          </form>
          {loadingLead && <div style={{ color: "#747474" }}>Loading lead…</div>}
          {!loadingLead && !lead && !currentPhone && wrapped && (
            <div style={{ color: "#2e844a", padding: 24, textAlign: "center" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Disposition saved ✓</div>
              <div style={{ color: "#747474" }}>Waiting for the next call…</div>
            </div>
          )}
          {!loadingLead && !lead && !currentPhone && !wrapped && (
            <div style={{ color: "#747474", padding: 24, textAlign: "center" }}>
              {toolkitMode ? "Waiting for a Five9 call. The matching CRM lead will load here." : "No lead selected. Search by phone above, or use the CRM-linked Five9 view for automatic lookup."}
            </div>
          )}
          {lookupError && <p role="alert" style={{ color: "#ba1a1a", fontSize: 12 }}>{lookupError}</p>}
          {matches.length > 0 && <MatchSelector matches={matches} selectedId={lead?.id ?? null} onSelect={setLead} />}
          {!loadingLead && !lookupError && !lead && currentPhone && (
            <QuickCreateLead phone={currentPhone} assignedToId={userId} onCreated={() => void popLead(currentPhone, callSinceRef.current)} />
          )}
          {lead && (
            <LeadCard
              key={lead.id}
              lead={lead}
              onSaved={handleLeadSaved}
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
        {!toolkitMode && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 8 }}>
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
        </div>}
        {toolkitMode ? <Five9ToolkitBridge
          expectedFive9Login={expectedFive9Login}
          onCallStarted={(id, phone) => {
            const newCall = toolkitCallIdRef.current !== id;
            toolkitCallIdRef.current = id;
            if (!phone) { setActiveUnmatched(true); return; }
            setActiveUnmatched(false);
            if (newCall || last10(phone) !== last10(currentPhoneRef.current)) void popLead(phone, null);
          }}
          onCallFinished={id => {
            if (toolkitCallIdRef.current !== id) return;
            toolkitCallIdRef.current = null;
            clearPane();
          }}
        /> : poppedOut ? (
          <div
            style={{
              border: "1px solid #c9c9c9", borderRadius: 4, background: "#fff",
              height: "calc(100vh - 170px)", minHeight: 560, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, gap: 12, color: "#444444",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Five9 is running in its own window</div>
            <div style={{ fontSize: 13, color: "#747474", maxWidth: 420 }}>
              Keeping Five9 in its own window helps preserve its login. Find the CRM lead by phone in the left panel.
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

    </div>
  );
}

function MatchSelector({ matches, selectedId, onSelect }: {
  matches: LeadContext[];
  selectedId: string | null;
  onSelect: (lead: LeadContext) => void;
}) {
  return (
    <div style={{ marginBottom: 14, border: "1px solid #b6c8dd", borderRadius: 6, overflow: "hidden" }}>
      <div style={{ padding: "9px 12px", background: "#eef5fc", fontSize: 13, fontWeight: 700 }}>
        Existing leads for this phone ({matches.length}){matches.length > 1 ? " — select the person on this call" : ""}
      </div>
      <div style={{ maxHeight: 240, overflowY: "auto" }}>
        {matches.map(item => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selectedId === item.id}
            onClick={() => onSelect(item)}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: 0, borderTop: "1px solid #e1e8f0", background: selectedId === item.id ? "#dceeff" : "#fff", color: "#181818", cursor: "pointer" }}
          >
            <strong>{item.contactName || "Unnamed lead"}</strong>
            <span style={{ color: "#555", marginLeft: 8 }}>{item.businessName} · {item.status}</span>
            <span style={{ display: "block", color: "#64748b", fontSize: 11 }}>
              Brand: {item.brand || "—"} · Source: {item.source || "—"} · Self-reported debt: {item.debtRange || "—"} · Added {new Date(item.createdAt).toLocaleDateString()}
            </span>
            <span style={{ display: "block", color: "#64748b", fontSize: 11 }}>{item.email || item.phone} · {item.sfId || item.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Inline quick-create for a closer on a live call: the dialed number matched no
 * lead, so capture a new one (phone pre-filled) without leaving the call. On
 * save it reloads via by-phone so the LeadCard pops immediately.
 */
function QuickCreateLead({ phone, assignedToId, onCreated }: { phone: string; assignedToId?: string; onCreated: () => void }) {
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phoneVal, setPhoneVal] = useState(phone);
  const [email, setEmail] = useState("");
  const [brand, setBrand] = useState("");
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
          brand,
          totalDebtEst: debtNum > 0 ? debtNum : "",
          numberOfLenders: numberOfLenders.trim() === "" || Number.isNaN(lendersNum) ? "" : lendersNum,
          notes: notes.trim(),
          source: "COLD_CALL",
          assignedToId,
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
        <label style={labelStyle}>
          Brand
          <select style={inputStyle} value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Select brand</option>
            {BRANDS.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
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
 * One lead form combines imported Salesforce context with the CRM fields the
 * opener can correct during a call. Keyed by lead.id in the parent so it
 * reseeds for each new call.
 */
const editableFields = [
  ["firstName", "First Name"], ["lastName", "Last Name"],
  ["email", "Email"], ["alternateEmail", "Alternate Email"],
  ["phone", "Phone"], ["mobilePhone", "Mobile Phone"], ["workPhone", "Work Phone"],
  ["businessName", "Company"], ["ein", "EIN Number / Tax Id"],
  ["street", "Street"], ["city", "City"], ["state", "State"], ["postalCode", "Postal Code"],
  ["industry", "Industry"], ["brand", "Brand"], ["source", "Lead Source"], ["debtRange", "Self-reported debt range"],
  ["totalDebtEst", "Real debt amount"], ["numberOfLenders", "# of lenders"],
  ["utmTerm", "UTM Term"], ["comments", "Comments"],
  ["hasCalendlyEvent", "Has Calendly Event"],
] as const;
type EditableKey = typeof editableFields[number][0];
type LeadDraft = Record<EditableKey, string>;

function editableDraft(lead: LeadContext): LeadDraft {
  return Object.fromEntries(editableFields.map(([key]) => [key,
    key === "hasCalendlyEvent" ? (lead.hasCalendlyEvent == null ? "" : String(lead.hasCalendlyEvent)) :
    lead[key] == null ? "" : String(lead[key]),
  ])) as LeadDraft;
}

function LeadCard({ lead, onSaved, onDispositioned }: { lead: LeadContext; onSaved: (l: LeadContext) => void; onDispositioned: () => void }) {
  const [draft, setDraft] = useState<LeadDraft>(() => editableDraft(lead));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dispOpen, setDispOpen] = useState(false);

  // On an active call the opener is "Working Lead"; fall back to it if the raw
  // status isn't one of the canonical V2 stages.
  const currentStage: LeadStatusV2 = (LEAD_STATUSES as readonly string[]).includes(lead.status)
    ? (lead.status as LeadStatusV2)
    : "Working Lead";

  const original = editableDraft(lead);
  const changed = editableFields.map(([key]) => key).filter(key => draft[key] !== original[key]);
  const dirty = changed.length > 0;

  function setField(key: EditableKey, value: string) {
    setDraft(previous => ({ ...previous, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setError(null);
    const contactName = [draft.firstName.trim(), draft.lastName.trim()].filter(Boolean).join(" ");
    if (!contactName) {
      setError("First or last name is required.");
      return;
    }
    setSaving(true);
    try {
      if (draft.totalDebtEst.trim() && (!Number.isFinite(Number(draft.totalDebtEst)) || Number(draft.totalDebtEst) < 0)) {
        setError("Enter a valid real debt amount."); return;
      }
      if (draft.numberOfLenders.trim() && (!Number.isInteger(Number(draft.numberOfLenders)) || Number(draft.numberOfLenders) < 0)) {
        setError("Enter a valid number of lenders."); return;
      }
      const payload: Record<string, string | number | boolean | null> = {};
      for (const key of changed) {
        if (key === "totalDebtEst" || key === "numberOfLenders") payload[key] = draft[key].trim() ? Number(draft[key]) : null;
        else if (key === "hasCalendlyEvent") payload[key] = draft[key] === "" ? null : draft[key] === "true";
        else if (key === "brand") payload[key] = draft[key] || null;
        else payload[key] = draft[key];
      }
      const res = await fetch(`/api/leads/${lead.id}/five9-context`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? "Failed to save");
        return;
      }
      onSaved({
        ...lead,
        contactName: changed.includes("firstName") || changed.includes("lastName") ? contactName : lead.contactName,
        firstName: draft.firstName.trim() || null,
        lastName: draft.lastName.trim() || null,
        businessName: draft.businessName.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim(),
        source: draft.source.trim() || "OTHER",
        brand: draft.brand || null,
        debtRange: draft.debtRange.trim() || null,
        alternateEmail: draft.alternateEmail.trim() || null,
        street: draft.street.trim() || null,
        city: draft.city.trim() || null,
        state: draft.state.trim() || null,
        postalCode: draft.postalCode.trim() || null,
        mobilePhone: draft.mobilePhone.trim() || null,
        workPhone: draft.workPhone.trim() || null,
        ein: draft.ein.trim() || null,
        industry: draft.industry.trim() || null,
        utmTerm: draft.utmTerm.trim() || null,
        comments: draft.comments.trim() || null,
        hasCalendlyEvent: draft.hasCalendlyEvent === "" ? null : draft.hasCalendlyEvent === "true",
        totalDebtEst: draft.totalDebtEst.trim() ? Number(draft.totalDebtEst) : null,
        numberOfLenders: draft.numberOfLenders.trim() ? Number(draft.numberOfLenders) : null,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = { width: "100%", padding: "6px 8px", border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13, marginTop: 2, boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "#747474", fontWeight: 600 };

  return (
    <div>
      <section style={{ border: "1px solid #d8dde6", borderRadius: 6, padding: 12, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Lead details <span style={{ color: "#64748b", fontSize: 12, fontWeight: 400 }}>· {lead.status}</span></h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px 24px" }}>
          <DetailValue label="Lead Id" value={lead.sfId ?? lead.id} />
          {editableFields.map(([key, label]) => (
            <label key={key} style={{ ...labelStyle, gridColumn: key === "comments" ? "1 / -1" : undefined }}>
              {label}
              {key === "brand" ? (
                <select style={inputStyle} value={draft[key]} onChange={e => setField(key, e.target.value)}>
                  <option value="">No brand</option>
                  {draft[key] && !(BRANDS as readonly string[]).includes(draft[key]) && <option value={draft[key]}>{draft[key]}</option>}
                  {BRANDS.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              ) : key === "hasCalendlyEvent" ? (
                <select style={inputStyle} value={draft[key]} onChange={e => setField(key, e.target.value)}>
                  <option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option>
                </select>
              ) : key === "comments" ? (
                <textarea style={{ ...inputStyle, minHeight: 68 }} value={draft[key]} onChange={e => setField(key, e.target.value)} />
              ) : (
                <input
                  style={inputStyle}
                  type={key === "email" || key === "alternateEmail" ? "email" : "text"}
                  inputMode={key === "totalDebtEst" || key === "numberOfLenders" ? "decimal" : key === "phone" || key === "mobilePhone" || key === "workPhone" ? "tel" : undefined}
                  value={draft[key]}
                  onChange={e => setField(key, e.target.value)}
                />
              )}
            </label>
          ))}
          <DetailValue label="Last contact" value={lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString() : null} />
        </div>
        {error && <div style={{ color: "#c23934", fontSize: 12 }}>{error}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 16 }}>
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
        </div>
      </section>

      <DispositionModal
        endpoint={`/api/leads/${lead.id}/disposition`}
        stages={LEAD_STATUSES}
        subDispositionsByStage={STAGE_TO_SUB_DISPOSITIONS}
        currentStage={currentStage}
        open={dispOpen}
        onClose={() => setDispOpen(false)}
        onSaved={onDispositioned}
      />

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

function DetailValue({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: "#747474", fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ color: "#181818", fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{value || "—"}</div>
    </div>
  );
}
