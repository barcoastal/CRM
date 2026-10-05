"use client";
import { useEffect, useState } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  ChevronDown,
  X,
  Headphones,
  ArrowRightLeft,
  Check,
  Delete,
} from "lucide-react";
import Link from "next/link";
import { usePhone } from "./provider";
import { DISPOSITIONS, isTerminal } from "@/lib/call-center/model";
export function PhonePanel({ inline = false }: { inline?: boolean }) {
  const p = usePhone(),
    call = p.active;
  const [number, setNumber] = useState(""),
    [outcome, setOutcome] = useState(""),
    [notes, setNotes] = useState(""),
    [callback, setCallback] = useState("");
  const [target, setTarget] = useState(""),
    [saving, setSaving] = useState(false),
    [now, setNow] = useState(0),
    [keypad, setKeypad] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setOutcome("");
    setNotes("");
    setCallback("");
    setTarget("");
  }, [call?.id]);
  const done = !!call && isTerminal(call.status);
  const owner = call?.agentId === p.data?.userId;
  const transfer = call?.participants.find(
    (x) => x.role === "TRANSFER" && !x.endedAt,
  );
  const seconds =
    call?.answeredAt && now
      ? Math.max(
          0,
          Math.floor(
            ((call.endedAt ? Date.parse(call.endedAt) : now) -
              Date.parse(call.answeredAt)) /
              1000,
          ),
        )
      : 0;
  const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  async function run(action: () => Promise<unknown>) {
    setSaving(true);
    p.setError("");
    try {
      await action();
      await p.refresh();
    } catch (e) {
      p.setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }
  if (!inline && !p.open) return null;
  return (
    <aside
      className={`cc-phone ${inline ? "cc-phone-inline" : "cc-phone-floating"}`}
      aria-label="CRM phone"
      style={!inline ? { bottom: 46 } : undefined}
    >
      <header className="cc-phone-head">
        <span>
          <Headphones size={18} /> CRM Phone
        </span>
        <div>
          <span className={`cc-dot ${p.connected ? "green" : ""}`} />
          {p.connected ? "Connected" : "Offline"}
          {!inline && (
            <button
              aria-label="Minimize phone"
              onClick={() => p.setOpen(false)}
            >
              <ChevronDown size={18} />
            </button>
          )}
        </div>
      </header>
      <div className="cc-phone-body">
        {p.error && (
          <div className="cc-error" role="alert">
            {p.error}
            <button aria-label="Dismiss error" onClick={() => p.setError("")}>
              <X size={14} />
            </button>
          </div>
        )}
        {!p.connected && !call && (
          <div className="cc-connect">
            <div className="cc-phone-avatar">
              <Headphones size={27} />
            </div>
            <h3>Your workspace. Your phone.</h3>
            <p>
              Use your headset to call, receive calls, and work across the CRM.
            </p>
            <button
              className="cc-button primary"
              disabled={
                p.connecting || !p.data?.setup.ready || !p.data?.setup.enabled
              }
              onClick={() => void p.connect()}
            >
              {p.connecting ? "Connecting…" : "Connect phone"}
            </button>
            {!p.data?.setup.ready && <small>Waiting for Twilio setup</small>}
          </div>
        )}
        {call ? (
          <>
            <div className="cc-call-identity">
              <span className="cc-eyebrow">
                {p.incoming
                  ? "INCOMING CALL"
                  : done
                    ? "CALL COMPLETE"
                    : call.held
                      ? "CUSTOMER ON HOLD"
                      : call.direction === "INBOUND"
                        ? "INBOUND CALL"
                        : "OUTBOUND CALL"}
              </span>
              <h3>{call.call?.lead?.contactName || call.phoneNumber}</h3>
              <p>
                {call.call?.lead?.businessName ||
                  call.queue?.name ||
                  call.phoneNumber}
              </p>
              <strong className="cc-call-time">
                {done || call.answeredAt
                  ? duration
                  : call.status.replaceAll("_", " ")}
              </strong>
              {call.leadId && (
                <Link href={`/leads/${call.leadId}`}>Open lead record ↗</Link>
              )}
            </div>
            {p.incoming ? (
              <div className="cc-control-row">
                <button className="cc-button danger" onClick={p.reject}>
                  <PhoneOff size={16} /> Decline
                </button>
                <button className="cc-button primary" onClick={p.accept}>
                  <Phone size={16} /> Answer
                </button>
              </div>
            ) : (
              !done && (
                <>
                  <div className="cc-control-row">
                    <button
                      className={`cc-control ${p.muted ? "selected" : ""}`}
                      onClick={p.mute}
                    >
                      {p.muted ? <MicOff /> : <Mic />}
                      <span>{p.muted ? "Unmute" : "Mute"}</span>
                    </button>
                    {owner && (
                      <button
                        className={`cc-control ${call.held ? "selected" : ""}`}
                        disabled={saving || !call.answeredAt}
                        onClick={() =>
                          void run(() =>
                            p.command({
                              action: "hold",
                              id: call.id,
                              held: !call.held,
                            }),
                          )
                        }
                      >
                        {call.held ? <Play /> : <Pause />}
                        <span>{call.held ? "Resume" : "Hold"}</span>
                      </button>
                    )}
                    <button
                      className="cc-control"
                      onClick={() => setKeypad(!keypad)}
                    >
                      <span className="cc-keypad-icon">⁙</span>
                      <span>Keypad</span>
                    </button>
                  </div>
                  {keypad && (
                    <div className="cc-keypad">
                      {"123456789*0#".split("").map((d) => (
                        <button key={d} onClick={() => p.digits(d)}>
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                  {owner && call.leadId && p.data?.sales?.role === "OPENER" && (
                    <div className="cc-transfer">
                      <Link
                        href="/call-center/opener"
                        onClick={() => p.setOpen(false)}
                      >
                        Open transfer approval and closer controls →
                      </Link>
                    </div>
                  )}
                  {owner &&
                    call.answeredAt &&
                    !(call.leadId && p.data?.sales?.role === "OPENER") && (
                      <div className="cc-transfer">
                        <label>Warm transfer</label>
                        {transfer ? (
                          <>
                            <p>
                              {transfer.joinedAt
                                ? "Agent joined. Consult, then complete the transfer."
                                : "Ringing receiving agent…"}
                            </p>
                            <div className="cc-control-row">
                              <button
                                className="cc-button"
                                disabled={saving}
                                onClick={() =>
                                  void run(() =>
                                    p.command({
                                      action: "cancel-transfer",
                                      id: call.id,
                                    }),
                                  )
                                }
                              >
                                Cancel
                              </button>
                              <button
                                className="cc-button primary"
                                disabled={saving || !transfer.joinedAt}
                                onClick={() =>
                                  void run(() =>
                                    p.command({
                                      action: "complete-transfer",
                                      id: call.id,
                                    }),
                                  )
                                }
                              >
                                <Check size={15} /> Complete
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="cc-inline-fields">
                            <select
                              aria-label="Transfer to agent"
                              value={target}
                              onChange={(e) => setTarget(e.target.value)}
                            >
                              <option value="">Select available agent</option>
                              {p.data?.users
                                .filter(
                                  (u) =>
                                    u.id !== p.data?.userId &&
                                    (!p.data?.supervisor ||
                                      p.data?.agents.some(
                                        (a) =>
                                          a.userId === u.id &&
                                          a.status === "AVAILABLE",
                                      )),
                                )
                                .map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                            </select>
                            <button
                              className="cc-button"
                              aria-label="Start warm transfer"
                              disabled={!target || saving}
                              onClick={() =>
                                void run(() =>
                                  p.command({
                                    action: "transfer",
                                    id: call.id,
                                    target,
                                  }),
                                )
                              }
                            >
                              <ArrowRightLeft size={17} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  <button
                    className="cc-button danger cc-full"
                    disabled={saving}
                    onClick={() => void run(p.hangup)}
                  >
                    <PhoneOff size={17} />
                    {owner ? "End call" : "Leave call"}
                  </button>
                </>
              )
            )}
            {done && owner && !call.disposition && (
              <form
                className="cc-disposition"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() =>
                    p.command({
                      action: "disposition",
                      id: call.id,
                      value: outcome,
                      notes,
                      ...(callback
                        ? { callbackAt: new Date(callback).toISOString() }
                        : {}),
                    }),
                  );
                }}
              >
                <label>
                  Call outcome
                  <select
                    required
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                  >
                    <option value="">Choose an outcome</option>
                    {DISPOSITIONS.map((d) => (
                      <option key={d} value={d}>
                        {d.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                {outcome === "CALLBACK" && (
                  <label>
                    Callback time
                    <input
                      type="datetime-local"
                      required
                      value={callback}
                      onChange={(e) => setCallback(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  Call notes
                  <textarea
                    placeholder="What should the team know?"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={10000}
                  />
                </label>
                <button className="cc-button primary cc-full" disabled={saving}>
                  Save outcome
                </button>
              </form>
            )}
          </>
        ) : (
          p.connected &&
          !p.automatic && (
            <>
              <label className="cc-number-label">
                Make a call
                <div className="cc-number">
                  <input
                    aria-label="Phone number"
                    type="tel"
                    placeholder="Enter a phone number"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                  />
                  <button
                    aria-label="Delete last digit"
                    onClick={() => setNumber((n) => n.slice(0, -1))}
                  >
                    <Delete size={18} />
                  </button>
                </div>
              </label>
              <div className="cc-keypad">
                {"123456789*0#".split("").map((d, i) => (
                  <button key={d} onClick={() => setNumber((n) => n + d)}>
                    {d}
                    <small>
                      {
                        [
                          "",
                          "ABC",
                          "DEF",
                          "GHI",
                          "JKL",
                          "MNO",
                          "PQRS",
                          "TUV",
                          "WXYZ",
                          "",
                          "+",
                          "",
                        ][i]
                      }
                    </small>
                  </button>
                ))}
              </div>
              <button
                className="cc-button primary cc-full"
                disabled={!number || p.busy || saving}
                onClick={() => void run(() => p.dial({ phone: number }))}
              >
                <Phone size={16} /> Call
              </button>
            </>
          )
        )}
        {p.automatic && !call && (
          <div className="cc-connect">
            <Headphones size={28} />
            <h3>Automatic dialing</h3>
            <p>
              {p.data?.me?.status === "PAUSED"
                ? "You are paused. Set availability to Available when you are ready."
                : "Audio is open. Your next conversation will connect here automatically."}
            </p>
            <button
              className="cc-button"
              disabled={saving}
              onClick={() => void run(p.leaveOutbound)}
            >
              Leave automatic dialing
            </button>
          </div>
        )}
        {p.connected && !call && (
          <div className="cc-phone-footer">
            <span>
              {p.data?.me?.status === "AVAILABLE"
                ? "Available for incoming calls"
                : "Paused · outbound calls ready"}
            </span>
            <button onClick={() => void run(p.offline)}>Disconnect</button>
          </div>
        )}
      </div>
    </aside>
  );
}
