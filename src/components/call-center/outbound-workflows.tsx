"use client";
import { useState } from "react";
import Link from "next/link";
import { Zap, Layers, Headphones, Settings2, Play, Pause } from "lucide-react";
import { usePhone } from "./provider";
export function OutboundWorkflows() {
  const p = usePhone(),
    data = p.data,
    outbound = data?.outbound;
  const [editing, setEditing] = useState(false),
    [members, setMembers] = useState<string[]>([]);
  const [webEnabled, setWebEnabled] = useState(false),
    [campaignId, setCampaignId] = useState("");
  const [maxLines, setMaxLines] = useState(10),
    [saving, setSaving] = useState(false);
  const config = outbound?.coldCampaigns.find(
    (c) => c.campaignId === campaignId,
  );
  const waiting =
    outbound?.webLeads.filter((l) =>
      ["WAITING", "CLAIMED", "FAILED"].includes(l.status),
    ) || [];
  async function run(fn: () => Promise<unknown>) {
    setSaving(true);
    p.setError("");
    try {
      await fn();
      await p.refresh();
    } catch (error) {
      p.setError(
        error instanceof Error
          ? error.message
          : "Could not save dialing settings",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="cc-outbound" aria-label="Automatic outbound workflows">
      <div className="cc-outbound-toolbar">
        <div>
          <h2>Two ways to reach your leads</h2>
          <p>
            Web leads get the next available priority agent. Cold calls use the
            remaining team capacity.
          </p>
        </div>
        <button
          className={`cc-button ${p.automatic ? "" : "primary"}`}
          disabled={!p.connected || !!p.active || p.busy || saving}
          onClick={() =>
            void run(p.automatic ? p.leaveOutbound : p.joinOutbound)
          }
        >
          <Headphones size={16} />
          {p.automatic ? "Leave automatic dialing" : "Join automatic dialing"}
        </button>
      </div>
      {p.automatic && (
        <div className="cc-seat-status">
          <span className="cc-dot green" />
          {data?.me?.status === "PAUSED"
            ? "Automatic dialing paused. Set your availability to Available to receive calls."
            : "Your audio is connected. Calls arrive automatically; save each outcome to become available again."}
        </div>
      )}
      <div className="cc-workflow-grid">
        <section className="cc-card cc-workflow">
          <div className="cc-section-title">
            <div className="cc-workflow-title">
              <span className="cc-metric-icon amber">
                <Zap size={21} />
              </span>
              <div>
                <span className="cc-eyebrow">01 / WEB LEADS</span>
                <h2>Call within 1 minute</h2>
              </div>
            </div>
            <span
              className={`cc-badge ${outbound?.settings?.webEnabled ? "green" : ""}`}
            >
              {outbound?.settings?.webEnabled
                ? "Priority routing on"
                : "Not enabled"}
            </span>
          </div>
          <div className="cc-workflow-body">
            <p>
              New web leads enter the shared priority queue automatically. The
              next ready agent calls first, ahead of new cold-list calls.
            </p>
            <div className="cc-workflow-stats">
              <div>
                <strong>
                  {outbound?.webCounts?.waiting ?? waiting.length}
                </strong>
                <span>awaiting first call</span>
              </div>
              <div>
                <strong
                  className={waiting.some((l) => l.sla.missed) ? "cc-late" : ""}
                >
                  {outbound?.webCounts?.overdue ??
                    waiting.filter((l) => l.sla.missed).length}
                </strong>
                <span>past 60 seconds</span>
              </div>
              <div>
                <strong>{outbound?.settings?.webMemberIds.length || 0}</strong>
                <span>priority agents</span>
              </div>
            </div>
            <div className="cc-priority-list">
              {waiting.length ? (
                waiting
                  .slice()
                  .sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt))
                  .slice(0, 5)
                  .map((l) => (
                    <div className="cc-priority-row" key={l.leadId}>
                      <div>
                        <Link href={`/leads/${l.leadId}`}>
                          {l.lead.contactName}
                        </Link>
                        <small>
                          {l.reason ||
                            (l.status === "CLAIMED"
                              ? "Connecting the agent"
                              : "Waiting for the next agent")}
                        </small>
                      </div>
                      <span
                        className={`cc-badge ${l.sla.missed ? "amber" : "green"}`}
                      >
                        {l.sla.missed ? "Overdue" : `${l.sla.seconds}s left`}
                      </span>
                    </div>
                  ))
              ) : (
                <p className="cc-muted">
                  New web leads and their first-call timers will appear here.
                </p>
              )}
            </div>
            {outbound?.canConfigureWeb && (
              <button
                className="cc-button"
                onClick={() => {
                  setMembers(outbound.settings?.webMemberIds || []);
                  setWebEnabled(!!outbound.settings?.webEnabled);
                  setEditing(true);
                }}
              >
                <Settings2 size={15} />
                Manage priority team
              </button>
            )}
            <small className="cc-workflow-footnote">
              The timer starts when the lead enters the CRM. Calling hours and
              Do Not Call checks still apply.
            </small>
          </div>
        </section>
        <section className="cc-card cc-workflow">
          <div className="cc-section-title">
            <div className="cc-workflow-title">
              <span className="cc-metric-icon blue">
                <Layers size={21} />
              </span>
              <div>
                <span className="cc-eyebrow">02 / COLD LISTS</span>
                <h2>Parallel power dialing</h2>
              </div>
            </div>
            <span className="cc-badge">Team-wide</span>
          </div>
          <div className="cc-workflow-body">
            <p>
              Call 10 or more leads simultaneously across the team. Answered
              calls connect to agents with open audio; voicemail is screened
              out.
            </p>
            <div className="cc-cold-controls">
              <label>
                Cold-lead campaign
                <select
                  aria-label="Cold-lead campaign"
                  value={campaignId}
                  onChange={(e) => {
                    setCampaignId(e.target.value);
                    setMaxLines(
                      outbound?.coldCampaigns.find(
                        (c) => c.campaignId === e.target.value,
                      )?.maxLines || 10,
                    );
                  }}
                >
                  <option value="">Choose a campaign</option>
                  {data?.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Maximum simultaneous lines
                <input
                  aria-label="Maximum simultaneous lines"
                  type="number"
                  min={1}
                  max={100}
                  value={maxLines}
                  disabled={!data?.supervisor}
                  onChange={(e) => setMaxLines(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="cc-workflow-stats">
              <div>
                <strong>
                  {config?.inFlight || 0}
                  <small> / {maxLines}</small>
                </strong>
                <span>active outbound lines</span>
              </div>
              <div>
                <strong>{config?.answered || 0}</strong>
                <span>live answers · 30 days</span>
              </div>
              <div>
                <strong>{config?.abandoned || 0}</strong>
                <span>missed agent connections</span>
              </div>
            </div>
            {config?.pauseReason && (
              <p className="cc-setup-banner">{config.pauseReason}</p>
            )}
            {data?.supervisor && (
              <div className="cc-control-row">
                <button
                  className="cc-button primary"
                  disabled={
                    !campaignId ||
                    saving ||
                    !data.setup.ready ||
                    !data.setup.enabled ||
                    !Number.isInteger(maxLines) ||
                    maxLines < 1 ||
                    maxLines > 100
                  }
                  onClick={() =>
                    void run(() =>
                      p.command({
                        action: "cold-campaign",
                        campaignId,
                        maxLines,
                        lineScope: "TEAM",
                        running: true,
                      }),
                    )
                  }
                >
                  <Play size={16} />
                  {config?.status === "RUNNING"
                    ? "Update line limit"
                    : "Start campaign"}
                </button>
                {config?.status === "RUNNING" && (
                  <button
                    className="cc-button"
                    disabled={saving}
                    onClick={() =>
                      void run(() =>
                        p.command({
                          action: "cold-campaign",
                          campaignId,
                          maxLines,
                          lineScope: "TEAM",
                          running: false,
                        }),
                      )
                    }
                  >
                    <Pause size={16} />
                    Pause
                  </button>
                )}
              </div>
            )}
            <small className="cc-workflow-footnote">
              The dialer adjusts to ready agents and pickup rates. New calls
              pause when no agents are ready or a priority lead is waiting.
              Pausing lets existing conversations finish.
            </small>
          </div>
        </section>
      </div>
      {editing && (
        <div className="cc-modal-backdrop">
          <form
            className="cc-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Web lead priority team"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await p.command({
                  action: "web-routing",
                  enabled: webEnabled,
                  members,
                  ownerFirst: false,
                });
                setEditing(false);
              });
            }}
          >
            <h2>Web lead priority team</h2>
            <p>
              Every new web lead goes to the next available team member. A lead
              is assigned to that agent when the call is prepared.
            </p>
            <label className="cc-check">
              <input
                type="checkbox"
                checked={webEnabled}
                onChange={(e) => setWebEnabled(e.target.checked)}
              />
              Enable the 60-second first-call workflow
            </label>
            <fieldset>
              <legend>Priority agents</legend>
              {data?.users.map((u) => (
                <label key={u.id} className="cc-check">
                  <input
                    type="checkbox"
                    checked={members.includes(u.id)}
                    onChange={(e) =>
                      setMembers(
                        e.target.checked
                          ? [...members, u.id]
                          : members.filter((id) => id !== u.id),
                      )
                    }
                  />
                  {u.name}
                </label>
              ))}
            </fieldset>
            <div className="cc-control-row">
              <button
                type="button"
                className="cc-button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button className="cc-button primary" disabled={saving}>
                Save priority team
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
