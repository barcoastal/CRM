"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Phone,
  Headphones,
  Users,
  ArrowUpRight,
  ArrowDownLeft,
  Radio,
  Settings2,
  Plus,
  Check,
  Play,
  Pause,
  PhoneCall,
  ListFilter,
} from "lucide-react";
import { usePhone } from "./provider";
import { isTerminal } from "@/lib/call-center/model";
import type { Queue } from "./types";
import { OutboundWorkflows } from "./outbound-workflows";
export function OperationsWorkspace() {
  const p = usePhone(),
    data = p.data;
  const [tab, setTab] = useState("activity"),
    [campaign, setCampaign] = useState(""),
    [power, setPower] = useState(false),
    [queue, setQueue] = useState<Partial<Queue> | null>(null),
    [saving, setSaving] = useState(false);
  const lastCall = useRef<string | null>(null);
  const activeId = data?.me?.activeCallId || null;
  useEffect(() => {
    if (activeId) lastCall.current = activeId;
  }, [activeId]);
  useEffect(() => {
    if (
      !power ||
      !campaign ||
      activeId ||
      !lastCall.current ||
      !p.connected ||
      p.busy
    )
      return;
    const call = data?.calls.find((c) => c.id === lastCall.current);
    if (!call?.disposition || call.agentId !== data?.userId) return;
    lastCall.current = null;
    void p.dial({ campaignId: campaign }).catch((e) => {
      setPower(false);
      p.setError(e.message);
    });
  }, [activeId, power, campaign, data, p]);
  async function run(fn: () => Promise<unknown>) {
    setSaving(true);
    p.setError("");
    try {
      await fn();
      await p.refresh();
    } catch (e) {
      p.setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }
  const live =
    data?.calls.filter(
      (c) => !isTerminal(c.status) && c.status !== "WAITING",
    ) || [];
  const waiting = data?.queues.reduce((n, q) => n + q._count.calls, 0) || 0;
  const available =
    data?.agents.filter((a) => a.status === "AVAILABLE").length || 0;
  const completed =
    data?.calls.filter(
      (c) =>
        c.endedAt &&
        new Date(c.endedAt).toDateString() === new Date().toDateString(),
    ).length || 0;
  const selectedCampaign = data?.campaigns.find((c) => c.id === campaign);
  return (
    <div className="cc-workspace">
      <div className="cc-title-row">
        <div>
          <div className="cc-eyebrow">COASTAL CRM / COMMUNICATIONS</div>
          <h1>
            Call center <span className="cc-beta">TWILIO</span>
          </h1>
          <p>Your team, your conversations, one workspace.</p>
        </div>
        <div className="cc-title-actions">
          <span className={`cc-connection ${p.connected ? "online" : ""}`}>
            <span className="cc-dot" />
            {p.connected ? "Phone connected" : "Phone offline"}
          </span>
          {p.connected ? (
            <select
              aria-label="Agent availability"
              value={data?.me?.status === "AVAILABLE" ? "AVAILABLE" : "PAUSED"}
              disabled={!!p.active || saving}
              onChange={(e) =>
                void run(() =>
                  p.command({ action: "heartbeat", status: e.target.value }),
                )
              }
            >
              <option value="AVAILABLE">Available</option>
              <option value="PAUSED">Paused</option>
            </select>
          ) : (
            <button
              className="cc-button primary"
              disabled={
                !data?.setup.enabled || !data?.setup.ready || p.connecting
              }
              onClick={() => void p.connect()}
            >
              <Headphones size={17} />
              {p.connecting ? "Connecting…" : "Connect phone"}
            </button>
          )}
        </div>
      </div>
      {(!data?.setup.ready || !data?.setup.enabled) && data && (
        <div className="cc-setup-banner">
          <Settings2 size={21} />
          <div>
            <strong>Connect Twilio to start calling</strong>
            <p>
              The workspace is ready for configuration. Add your Twilio
              credentials and number, then enable the call center.
            </p>
            {data.supervisor && data.setup.missing?.length ? (
              <details>
                <summary>Setup details</summary>
                <p>{data.setup.missing.join(", ")}</p>
              </details>
            ) : null}
          </div>
          <span>Setup pending</span>
        </div>
      )}
      {p.error && (
        <div className="cc-error" role="alert">
          {p.error}
          <button
            onClick={() => {
              p.setError("");
              void p.refresh().catch((e) => p.setError(e.message));
            }}
          >
            Retry
          </button>
        </div>
      )}
      <div className="cc-metrics">
        {[
          {
            label: "Live conversations",
            value: live.length,
            icon: PhoneCall,
            note: "Across your visible team",
            color: "blue",
          },
          {
            label: "Callers waiting",
            value: waiting,
            icon: Users,
            note: "In your inbound queues",
            color: "amber",
          },
          {
            label: "Agents available",
            value: available,
            icon: Headphones,
            note: "Ready for the next caller",
            color: "green",
          },
          {
            label: "Recent completed today",
            value: completed,
            icon: Check,
            note: "From the latest 80 calls",
            color: "purple",
          },
        ].map((m) => (
          <div className="cc-metric" key={m.label}>
            <div>
              <span>{m.label}</span>
              <strong>{m.value}</strong>
              <small>{m.note}</small>
            </div>
            <span className={`cc-metric-icon ${m.color}`}>
              <m.icon size={21} />
            </span>
          </div>
        ))}
      </div>
      <OutboundWorkflows />
      <div className="cc-main-grid">
        <div className="cc-main-column">
          <section className="cc-card">
            <div className="cc-tabs">
              {[
                { id: "activity", label: "Live activity", icon: Radio },
                { id: "queues", label: "Inbound queues", icon: Users },
                { id: "history", label: "Recent calls", icon: Phone },
              ].map((t) => (
                <button
                  key={t.id}
                  className={tab === t.id ? "active" : ""}
                  onClick={() => setTab(t.id)}
                >
                  <t.icon size={16} />
                  {t.label}
                  {t.id === "activity" && <span>{live.length}</span>}
                </button>
              ))}
              <span className="cc-live-indicator">
                <span className="cc-dot green" /> Updates every 5s
              </span>
            </div>
            {tab === "activity" && (
              <>
                <div className="cc-section-title">
                  <div>
                    <h2>On the floor</h2>
                    <p>
                      {data?.supervisor
                        ? "Follow conversations and support your team."
                        : "Keep track of your current conversations."}
                    </p>
                  </div>
                  <span className="cc-muted">
                    <ListFilter size={15} />{" "}
                    {data?.supervisor ? "Your team" : "Your calls"}
                  </span>
                </div>
                {live.length ? (
                  <div className="cc-table-wrap">
                    <table className="cc-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Agent</th>
                          <th>Status</th>
                          <th>Started</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {live.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <div className="cc-person">
                                <span className="cc-avatar">
                                  {c.direction === "INBOUND" ? (
                                    <ArrowDownLeft size={17} />
                                  ) : (
                                    <ArrowUpRight size={17} />
                                  )}
                                </span>
                                <div>
                                  <strong>
                                    {c.call?.lead?.contactName || c.phoneNumber}
                                  </strong>
                                  <small>
                                    {c.call?.lead?.businessName ||
                                      c.queue?.name ||
                                      c.direction.toLowerCase()}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>
                              {data?.users.find((u) => u.id === c.agentId)
                                ?.name || "Agent"}
                            </td>
                            <td>
                              <span
                                className={`cc-badge ${c.held ? "amber" : "green"}`}
                              >
                                {c.held
                                  ? "On hold"
                                  : c.status.replaceAll("_", " ").toLowerCase()}
                              </span>
                            </td>
                            <td>
                              {new Date(c.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td>
                              {c.agentId === data?.userId ? (
                                <button
                                  className="cc-text-button"
                                  onClick={() => p.setOpen(true)}
                                >
                                  Open phone
                                </button>
                              ) : data?.supervisor &&
                                c.status === "IN_PROGRESS" ? (
                                <div className="cc-monitor-actions">
                                  {["LISTEN", "WHISPER", "BARGE"].map(
                                    (mode) => (
                                      <button
                                        key={mode}
                                        disabled={
                                          !p.connected || !!p.active || saving
                                        }
                                        onClick={() =>
                                          void run(() => p.monitor(c.id, mode))
                                        }
                                      >
                                        {mode === "BARGE"
                                          ? "Join"
                                          : mode.charAt(0) +
                                            mode.slice(1).toLowerCase()}
                                      </button>
                                    ),
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="cc-empty">
                    <span>
                      <Radio size={28} />
                    </span>
                    <h3>Ready for the next conversation</h3>
                    <p>
                      Connected calls will appear here. Connect your phone and
                      become available, or start an outbound campaign.
                    </p>
                  </div>
                )}
              </>
            )}
            {tab === "queues" && (
              <>
                <div className="cc-section-title">
                  <div>
                    <h2>Inbound queues</h2>
                    <p>Route each number to its assigned agents.</p>
                  </div>
                  {data?.supervisor && (
                    <button
                      className="cc-button"
                      onClick={() =>
                        setQueue({
                          name: "",
                          phoneNumber: "",
                          enabled: true,
                          members: [],
                          maxWaitSeconds: 180,
                          greeting:
                            "Thank you for calling. Please stay on the line for the next available agent.",
                        })
                      }
                    >
                      <Plus size={15} /> Add queue
                    </button>
                  )}
                </div>
                <div className="cc-queue-list">
                  {data?.queues.length ? (
                    data.queues.map((q) => (
                      <div className="cc-queue-row" key={q.id}>
                        <span className="cc-avatar">
                          <Users size={18} />
                        </span>
                        <div>
                          <strong>{q.name}</strong>
                          <small>
                            {q.phoneNumber} · {q.members.length} agents
                          </small>
                        </div>
                        <span className="cc-queue-wait">
                          {q._count.calls}
                          <small>waiting</small>
                        </span>
                        <span
                          className={`cc-badge ${q.enabled ? "green" : ""}`}
                        >
                          {q.enabled ? "Active" : "Paused"}
                        </span>
                        {data.supervisor && (
                          <button
                            className="cc-text-button"
                            onClick={() => setQueue(q)}
                          >
                            Manage
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="cc-empty">
                      <h3>No queues yet</h3>
                      <p>
                        An administrator can add your Twilio number and assign
                        its team here.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
            {tab === "history" && (
              <>
                <div className="cc-section-title">
                  <div>
                    <h2>Recent conversations</h2>
                    <p>Outcomes and notes stay connected to the CRM.</p>
                  </div>
                  <Link href="/calls" className="cc-text-button">
                    All call history ↗
                  </Link>
                </div>
                <div className="cc-table-wrap">
                  <table className="cc-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Direction</th>
                        <th>Outcome</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.calls
                        .filter((c) => isTerminal(c.status))
                        .map((c) => (
                          <tr key={c.id}>
                            <td>
                              <strong>
                                {c.call?.lead?.contactName || c.phoneNumber}
                              </strong>
                              {c.recordingSid && (
                                <a
                                  className="cc-recording"
                                  href={`/api/call-center/recordings/${c.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Play recording
                                </a>
                              )}
                            </td>
                            <td>{c.direction.toLowerCase()}</td>
                            <td>
                              {(c.disposition || c.status)
                                .replaceAll("_", " ")
                                .toLowerCase()}
                            </td>
                            <td>{new Date(c.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
          <section className="cc-card cc-team">
            <div className="cc-section-title">
              <div>
                <h2>Team availability</h2>
                <p>
                  Presence is refreshed while agents keep their phones
                  connected.
                </p>
              </div>
              <Headphones size={19} />
            </div>
            <div className="cc-agents">
              {data?.agents.length ? (
                data.agents.map((a) => (
                  <div key={a.userId} className="cc-agent">
                    <span className="cc-agent-avatar">
                      {(a.user?.name || "A")
                        .split(" ")
                        .map((x) => x[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div>
                      <strong>
                        {a.user?.name || "Agent"}
                        {a.userId === data.userId ? " (you)" : ""}
                      </strong>
                      <small>
                        <span
                          className={`cc-dot ${a.status === "AVAILABLE" ? "green" : a.status === "BUSY" ? "blue" : ""}`}
                        />
                        {a.status.replaceAll("_", " ").toLowerCase()}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <p className="cc-muted">
                  Agents appear here when they connect their phone.
                </p>
              )}
            </div>
          </section>
        </div>
        <aside className="cc-side-column">
          <section className="cc-card cc-campaign">
            <div className="cc-section-title">
              <div>
                <span className="cc-eyebrow">OUTBOUND</span>
                <h2>One-at-a-time calls</h2>
              </div>
              <ArrowUpRight size={22} />
            </div>
            <div className="cc-campaign-body">
              <label>
                Campaign
                <select
                  value={campaign}
                  onChange={(e) => {
                    setCampaign(e.target.value);
                    setPower(false);
                    lastCall.current = null;
                  }}
                  disabled={!!p.active}
                >
                  <option value="">Select a campaign</option>
                  {data?.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="cc-campaign-count">
                <strong>{selectedCampaign?._count.contacts || "—"}</strong>
                <span>contacts remaining</span>
              </div>
              <label className="cc-switch">
                <input
                  type="checkbox"
                  checked={power}
                  onChange={(e) => setPower(e.target.checked)}
                />
                <div>
                  <strong>Auto-next call</strong>
                  <small>
                    Call the next eligible lead after saving an outcome.
                  </small>
                </div>
              </label>
              <button
                className="cc-button primary cc-full"
                disabled={
                  !campaign ||
                  !p.connected ||
                  p.automatic ||
                  !!p.active ||
                  p.busy ||
                  saving
                }
                onClick={() => void run(() => p.dial({ campaignId: campaign }))}
              >
                <Play size={16} /> Start calling
              </button>
              {power && (
                <button
                  className="cc-text-button"
                  onClick={() => setPower(false)}
                >
                  <Pause size={14} /> Pause power dialing
                </button>
              )}
              <div className="cc-campaign-rule">
                <Check size={15} /> Uses assignments, calling hours, and Do Not
                Call checks.
              </div>
            </div>
          </section>
          <section className="cc-card cc-script">
            <div className="cc-section-title">
              <h2>Conversation guide</h2>
            </div>
            <p>
              {selectedCampaign?.script ||
                "Select a campaign to see its call script here. Lead details, notes, and call outcomes remain available in the CRM."}
            </p>
            <Link href="/campaigns">Manage campaigns ↗</Link>
          </section>
        </aside>
      </div>
      {queue && (
        <div className="cc-modal-backdrop" role="presentation">
          <form
            className="cc-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Queue settings"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await p.command({
                  action: "queue",
                  id: queue.id,
                  name: queue.name,
                  phone: queue.phoneNumber,
                  enabled: queue.enabled,
                  greeting: queue.greeting,
                  maxWaitSeconds: queue.maxWaitSeconds,
                  members: queue.members?.map((m) => m.userId) || [],
                });
                setQueue(null);
              });
            }}
          >
            <h2>{queue.id ? "Manage queue" : "Create inbound queue"}</h2>
            <label>
              Name
              <input
                required
                value={queue.name || ""}
                onChange={(e) => setQueue({ ...queue, name: e.target.value })}
              />
            </label>
            <label>
              Twilio phone number
              <input
                type="tel"
                required
                value={queue.phoneNumber || ""}
                onChange={(e) =>
                  setQueue({ ...queue, phoneNumber: e.target.value })
                }
              />
            </label>
            <label>
              Greeting
              <textarea
                required
                value={queue.greeting || ""}
                onChange={(e) =>
                  setQueue({ ...queue, greeting: e.target.value })
                }
              />
            </label>
            <label>
              Maximum wait (seconds)
              <input
                type="number"
                min={30}
                max={900}
                required
                value={queue.maxWaitSeconds}
                onChange={(e) =>
                  setQueue({ ...queue, maxWaitSeconds: Number(e.target.value) })
                }
              />
            </label>
            <fieldset>
              <legend>Assigned agents</legend>
              {data?.users.map((u) => (
                <label className="cc-check" key={u.id}>
                  <input
                    type="checkbox"
                    checked={!!queue.members?.some((m) => m.userId === u.id)}
                    onChange={(e) =>
                      setQueue({
                        ...queue,
                        members: e.target.checked
                          ? [...(queue.members || []), { userId: u.id }]
                          : queue.members?.filter((m) => m.userId !== u.id),
                      })
                    }
                  />
                  {u.name}
                </label>
              ))}
            </fieldset>
            <label className="cc-check">
              <input
                type="checkbox"
                checked={queue.enabled}
                onChange={(e) =>
                  setQueue({ ...queue, enabled: e.target.checked })
                }
              />{" "}
              Queue enabled
            </label>
            <div className="cc-control-row">
              <button
                className="cc-button"
                type="button"
                onClick={() => setQueue(null)}
              >
                Cancel
              </button>
              <button className="cc-button primary" disabled={saving}>
                Save queue
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
