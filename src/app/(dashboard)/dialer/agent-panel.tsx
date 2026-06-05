"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DispositionModal } from "@/components/leads/disposition-modal";
import { LEAD_STATUSES, STAGE_TO_SUB_DISPOSITIONS } from "@/lib/sf-canonical";

interface CredentialsState {
  configured: boolean;
  five9Username: string | null;
  five9StationId: string | null;
}

interface SessionState {
  state: string;
  stationId?: string;
  activeCalls?: number;
}

interface RecentCall {
  id: string;
  phoneNumber: string;
  direction: string;
  status: string;
  disposition: string | null;
  duration: number | null;
  startedAt: string;
  leadId: string | null;
  lead?: { id: string; contactName: string; businessName: string } | null;
}

export function AgentPanel() {
  const [creds, setCreds] = useState<CredentialsState | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [credForm, setCredForm] = useState({ username: "", password: "", stationId: "" });
  const [dialNumber, setDialNumber] = useState("");
  const [showCredForm, setShowCredForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [activeCall, setActiveCall] = useState<{ callId: string; phone: string; leadId: string | null } | null>(null);
  const [onHold, setOnHold] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [dispoOpen, setDispoOpen] = useState(false);
  const [dispoLead, setDispoLead] = useState<{ id: string; status: string } | null>(null);

  async function loadCreds() {
    const res = await fetch("/api/dialer/five9/agent/credentials");
    if (res.ok) {
      const data = (await res.json()) as CredentialsState;
      setCreds(data);
      if (data.five9Username) setCredForm((f) => ({ ...f, username: data.five9Username ?? "" }));
      if (data.five9StationId) setCredForm((f) => ({ ...f, stationId: data.five9StationId ?? "" }));
    }
  }

  async function refreshSession() {
    const res = await fetch("/api/dialer/five9/agent/session");
    if (res.ok) {
      const data = (await res.json()) as { ok: boolean } & SessionState;
      if (data.ok) setSessionState(data);
    }
  }

  useEffect(() => {
    void loadCreds();
  }, []);

  useEffect(() => {
    if (!creds?.configured) return;
    void refreshSession();
    void refreshRecent();
    const interval = setInterval(() => {
      void refreshSession();
      void refreshRecent();
    }, 10_000);
    return () => clearInterval(interval);
  }, [creds?.configured]);

  async function refreshRecent() {
    const res = await fetch("/api/calls?limit=10");
    if (res.ok) {
      const data = (await res.json()) as { calls?: RecentCall[] };
      setRecentCalls(data.calls ?? []);
    }
  }

  async function saveCredentials() {
    if (!credForm.username || !credForm.password) {
      toast.error("Five9 username and password are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dialer/five9/agent/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          five9Username: credForm.username,
          five9Password: credForm.password,
          five9StationId: credForm.stationId || undefined,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to save credentials");
      } else {
        toast.success("Five9 credentials saved");
        setShowCredForm(false);
        setCredForm((f) => ({ ...f, password: "" }));
        await loadCreds();
      }
    } finally {
      setBusy(false);
    }
  }

  async function testLogin() {
    setBusy(true);
    try {
      const hasNewCreds = credForm.username && credForm.password;
      const res = await fetch("/api/dialer/five9/agent/test-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          hasNewCreds
            ? { five9Username: credForm.username, five9Password: credForm.password }
            : {},
        ),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; apiHost?: string };
      if (data.ok) {
        toast.success(`Login OK — data center: ${data.apiHost ?? "?"}`);
      } else {
        toast.error(data.error ?? "Login failed", { duration: 8000 });
      }
    } finally {
      setBusy(false);
    }
  }

  async function startSession() {
    setBusy(true);
    try {
      const res = await fetch("/api/dialer/five9/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationId: credForm.stationId || creds?.five9StationId || undefined }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) toast.error(data.error ?? "Failed to start Five9 session");
      else {
        toast.success("Connected to Five9");
        void refreshSession();
      }
    } finally {
      setBusy(false);
    }
  }

  async function endSession() {
    setBusy(true);
    try {
      await fetch("/api/dialer/five9/agent/session", { method: "DELETE" });
      setSessionState(null);
      toast.success("Logged out of Five9");
    } finally {
      setBusy(false);
    }
  }

  async function setState(state: "READY" | "NOT_READY") {
    setBusy(true);
    try {
      const res = await fetch("/api/dialer/five9/agent/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) toast.error(data.error ?? "Failed to change state");
      else void refreshSession();
    } finally {
      setBusy(false);
    }
  }

  async function dial() {
    if (!dialNumber) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dialer/five9/agent/click-to-dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: dialNumber }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; callId?: string; leadId?: string | null };
      if (!data.ok) toast.error(data.error ?? "Failed to place call");
      else {
        toast.success(`Calling ${dialNumber}`);
        if (data.callId) {
          setActiveCall({ callId: data.callId, phone: dialNumber, leadId: data.leadId ?? null });
        }
        setDialNumber("");
        void refreshSession();
        void refreshRecent();
      }
    } finally {
      setBusy(false);
    }
  }

  async function callAction(action: "hold" | "unhold" | "mute" | "unmute" | "transfer", destination?: string) {
    if (!activeCall) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dialer/five9/agent/call-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: activeCall.callId, action, destination }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        toast.error(data.error ?? `Failed to ${action}`);
        return;
      }
      if (action === "hold") setOnHold(true);
      if (action === "unhold") setOnHold(false);
      if (action === "mute") setMuted(true);
      if (action === "unmute") setMuted(false);
      if (action === "transfer") {
        toast.success(`Transferring to ${destination}`);
        setShowTransfer(false);
        setTransferTo("");
        // Transfer hangs up the agent's leg, so clear active state
        setActiveCall(null);
        setOnHold(false);
        setMuted(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function hangup() {
    if (!activeCall) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dialer/five9/agent/hangup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: activeCall.callId }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) toast.error(data.error ?? "Failed to hang up");
      else {
        toast.success("Call ended");
        setOnHold(false);
        setMuted(false);
        // If the call was tied to a lead, pop the disposition modal
        if (activeCall.leadId) {
          const leadRes = await fetch(`/api/leads/${activeCall.leadId}`);
          if (leadRes.ok) {
            const lead = (await leadRes.json()) as { id: string; status: string };
            setDispoLead({ id: lead.id, status: lead.status });
            setDispoOpen(true);
          }
        }
        setActiveCall(null);
        void refreshRecent();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    {dispoLead && (
      <DispositionModal
        endpoint={`/api/leads/${dispoLead.id}/disposition`}
        stages={LEAD_STATUSES}
        subDispositionsByStage={STAGE_TO_SUB_DISPOSITIONS as unknown as Record<string, readonly string[]>}
        currentStage={dispoLead.status}
        open={dispoOpen}
        onClose={() => { setDispoOpen(false); setDispoLead(null); }}
      />
    )}
    <article style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 4, padding: 16, minHeight: 600 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#3e3e3c", marginBottom: 16 }}>Five9 Dialer</h3>

      {!creds && <div style={{ color: "#706e6b", fontSize: 13 }}>Loading…</div>}

      {creds && !creds.configured && !showCredForm && (
        <div>
          <p style={{ fontSize: 13, color: "#706e6b", marginBottom: 12 }}>
            Connect your Five9 account to start dialing.
          </p>
          <button onClick={() => setShowCredForm(true)} style={btnPrimary}>
            Configure Five9
          </button>
        </div>
      )}

      {creds && (showCredForm || !creds.configured) && (
        <CredForm
          form={credForm}
          setForm={setCredForm}
          onSave={saveCredentials}
          onTest={testLogin}
          onCancel={() => setShowCredForm(false)}
          busy={busy}
        />
      )}

      {creds?.configured && !showCredForm && (
        <>
          <SessionPanel
            state={sessionState}
            onStart={startSession}
            onEnd={endSession}
            onReady={() => setState("READY")}
            onNotReady={() => setState("NOT_READY")}
            busy={busy}
          />

          {activeCall && (
            <>
              <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid #ecebea" }} />
              <div style={{ background: onHold ? "#fef0e8" : "#eaf5fe", border: `1px solid ${onHold ? "#fe9339" : "#1589ee"}`, borderRadius: 4, padding: 12 }}>
                <div style={{ fontSize: 11, color: onHold ? "#fe9339" : "#0070d2", fontWeight: 600, marginBottom: 4 }}>
                  {onHold ? "ON HOLD" : "ON CALL"}{muted ? " · MUTED" : ""}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{activeCall.phone}</div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <button onClick={() => callAction(onHold ? "unhold" : "hold")} disabled={busy} style={btnSecondary}>
                    {onHold ? "Resume" : "Hold"}
                  </button>
                  <button onClick={() => callAction(muted ? "unmute" : "mute")} disabled={busy} style={btnSecondary}>
                    {muted ? "Unmute" : "Mute"}
                  </button>
                  <button onClick={() => setShowTransfer(!showTransfer)} disabled={busy} style={btnSecondary}>
                    Transfer
                  </button>
                  <button onClick={hangup} disabled={busy} style={{ ...btnPrimary, background: "#c23934" }}>
                    Hang up
                  </button>
                </div>

                {showTransfer && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      placeholder="Transfer to: number, skill, or agent"
                      style={input}
                    />
                    <button onClick={() => callAction("transfer", transferTo)} disabled={busy || !transferTo} style={btnPrimary}>
                      Send
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid #ecebea" }} />

          <div>
            <label style={lbl}>Quick Dial</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={dialNumber}
                onChange={(e) => setDialNumber(e.target.value)}
                placeholder="+1 555 555 5555"
                style={input}
              />
              <button onClick={dial} disabled={busy || !dialNumber} style={btnPrimary}>
                Call
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 16 }}>
            <button onClick={() => setShowCredForm(true)} style={btnLink}>
              Change Five9 credentials
            </button>
            <button onClick={testLogin} disabled={busy} style={btnLink}>
              Test saved login
            </button>
          </div>

          <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid #ecebea" }} />

          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#3e3e3c" }}>Recent Calls</h4>
            {recentCalls.length === 0 && (
              <div style={{ fontSize: 12, color: "#706e6b" }}>No recent calls.</div>
            )}
            {recentCalls.length > 0 && (
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #ecebea", color: "#706e6b" }}>
                    <th style={{ textAlign: "left", padding: "4px 0", fontWeight: 600 }}>Phone</th>
                    <th style={{ textAlign: "left", padding: "4px 0", fontWeight: 600 }}>Disposition</th>
                    <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 600 }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCalls.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                      <td style={{ padding: "6px 0" }}>{c.phoneNumber}</td>
                      <td style={{ padding: "6px 0" }}>{c.disposition ?? c.status}</td>
                      <td style={{ padding: "6px 0", textAlign: "right" }}>
                        {c.duration ? `${Math.floor(c.duration / 60)}:${String(c.duration % 60).padStart(2, "0")}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </article>
    </>
  );
}

function CredForm({
  form,
  setForm,
  onSave,
  onTest,
  onCancel,
  busy,
}: {
  form: { username: string; password: string; stationId: string };
  setForm: (f: { username: string; password: string; stationId: string }) => void;
  onSave: () => void;
  onTest: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div>
      <label style={lbl}>Five9 Username</label>
      <input
        value={form.username}
        onChange={(e) => setForm({ ...form, username: e.target.value })}
        style={input}
        placeholder="agent@coastaldebt.com"
      />
      <label style={lbl}>Five9 Password</label>
      <input
        type="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        style={input}
      />
      <label style={lbl}>Station ID (optional — your softphone or station)</label>
      <input
        value={form.stationId}
        onChange={(e) => setForm({ ...form, stationId: e.target.value })}
        style={input}
        placeholder="e.g. softphone or 1001"
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onSave} disabled={busy} style={btnPrimary}>
          Save
        </button>
        <button onClick={onTest} disabled={busy} style={btnSecondary}>
          Test login
        </button>
        <button onClick={onCancel} disabled={busy} style={btnSecondary}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SessionPanel({
  state,
  onStart,
  onEnd,
  onReady,
  onNotReady,
  busy,
}: {
  state: SessionState | null;
  onStart: () => void;
  onEnd: () => void;
  onReady: () => void;
  onNotReady: () => void;
  busy: boolean;
}) {
  const connected = !!state?.state;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "#706e6b" }}>Status</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: connected ? "#04844b" : "#706e6b" }}>
            {connected ? state.state : "Disconnected"}
          </div>
        </div>
        {!connected ? (
          <button onClick={onStart} disabled={busy} style={btnPrimary}>
            Start Session
          </button>
        ) : (
          <button onClick={onEnd} disabled={busy} style={btnSecondary}>
            End Session
          </button>
        )}
      </div>
      {connected && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onReady} disabled={busy} style={btnSecondary}>
            Ready
          </button>
          <button onClick={onNotReady} disabled={busy} style={btnSecondary}>
            Not Ready
          </button>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "#706e6b", marginBottom: 4, marginTop: 12 };
const input: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  fontSize: 13,
};
const btnPrimary: React.CSSProperties = {
  background: "#0070d2",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  border: 0,
  cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  background: "#fff",
  color: "#0070d2",
  padding: "8px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  border: "1px solid #0070d2",
  cursor: "pointer",
};
const btnLink: React.CSSProperties = {
  background: "transparent",
  color: "#0070d2",
  fontSize: 12,
  border: 0,
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
};
