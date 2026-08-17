"use client";

/** Campaigns tab: Klaviyo-style blast list with status pills and quick stats. */
import { useState } from "react";
import Link from "next/link";

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  templateName: string | null;
  fromName: string | null;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  openCount: number;
  clickCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

const STATUS_PILL: Record<string, string> = {
  DRAFT: "ec-pill-neutral",
  SCHEDULED: "ec-pill-amber",
  SENDING: "ec-pill-amber",
  SENT: "ec-pill-live",
  FAILED: "ec-pill-danger",
  CANCELED: "ec-pill-neutral",
};

function rate(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function CampaignsClient({ campaigns: initial }: { campaigns: CampaignRow[] }) {
  const [campaigns, setCampaigns] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function cancel(id: string) {
    setBusy(id);
    const res = await fetch(`/api/emails/mass/${id}/cancel`, { method: "POST" });
    if (res.ok) {
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status: "CANCELED" } : c)));
    }
    setBusy(null);
  }

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Campaigns</h1>
          <p className="ec-flows-sub">One-time email blasts to segments, list views, or dialer campaigns.</p>
        </div>
        <Link className="ec-btn ec-btn-primary" href="/email-center/campaigns/new">New Campaign</Link>
      </div>
      {campaigns.length === 0 ? (
        <div className="ec-empty" style={{ paddingTop: 60 }}>
          <div className="ec-empty-title">No campaigns yet</div>
          <div className="ec-empty-sub">Create your first blast and pick an audience.</div>
        </div>
      ) : (
        <div className="ec-flows-list">
          {campaigns.map((c) => (
            <div key={c.id} className="ec-flow-row">
              <Link href={`/email-center/campaigns/${c.id}`} className="ec-flow-main">
                <span className="ec-flow-name">{c.name}</span>
                <span className="ec-flow-desc">
                  {c.templateName ?? "No template"}
                  {c.fromName ? ` · from ${c.fromName}` : ""}
                  {c.scheduledAt && c.status === "SCHEDULED"
                    ? ` · scheduled ${new Date(c.scheduledAt).toLocaleString()}`
                    : ""}
                </span>
              </Link>
              {c.status === "SENT" ? (
                <span className="ec-flow-stat">
                  {c.sentCount} sent · {rate(c.openCount, c.sentCount)} open · {rate(c.clickCount, c.sentCount)} click
                  {c.suppressedCount ? ` · ${c.suppressedCount} suppressed` : ""}
                </span>
              ) : (
                <span className="ec-flow-stat">{c.totalCount ? `${c.totalCount} recipients` : ""}</span>
              )}
              <span className={`ec-pill ${STATUS_PILL[c.status] ?? "ec-pill-neutral"}`}>
                {c.status.toLowerCase()}
              </span>
              {c.status === "DRAFT" || c.status === "SCHEDULED" ? (
                <button className="ec-btn ec-btn-ghost" disabled={busy === c.id} onClick={() => void cancel(c.id)}>
                  Cancel
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
