"use client";

/**
 * Domain Health: score gauge, SPF/DKIM/DMARC pass-fail with the records to fix,
 * reputation rates, and blacklist status. Admins can trigger a live re-check.
 */
import { useState } from "react";

interface Snapshot {
  spf: string; dkim: string; dmarc: string;
  spfRecord: string | null; dmarcRecord: string | null;
  bounceRate: number; complaintRate: number; openRate: number;
  score: number; blacklists: Array<{ zone: string; listed: boolean }>;
  createdAt: string;
}

function grade(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

function AuthRow({ label, status, record, fixHint }: { label: string; status: string; record: string | null; fixHint: string }) {
  const cls = status === "PASS" ? "ec-pill-live" : status === "UNKNOWN" ? "ec-pill-amber" : "ec-pill-danger";
  return (
    <div className="ec-flow-row">
      <span className="ec-flow-main">
        <span className="ec-flow-name">{label}</span>
        <span className="ec-flow-desc">{status === "PASS" ? (record ?? "Configured") : status === "UNKNOWN" ? "Could not resolve (offline or missing)" : fixHint}</span>
      </span>
      <span className={`ec-pill ${cls}`}>{status.toLowerCase()}</span>
    </div>
  );
}

export function HealthClient({ domain, isAdmin, initial }: { domain: string; isAdmin: boolean; initial: Snapshot | null }) {
  const [snap, setSnap] = useState<Snapshot | null>(initial);
  const [busy, setBusy] = useState(false);

  async function recheck() {
    setBusy(true);
    const res = await fetch("/api/email-center/domain-health", { method: "POST" });
    if (res.ok) {
      const fresh = await fetch("/api/email-center/domain-health").then((r) => r.json()).catch(() => null);
      if (fresh?.latest) {
        const l = fresh.latest;
        setSnap({
          spf: l.spf, dkim: l.dkim, dmarc: l.dmarc, spfRecord: l.spfRecord, dmarcRecord: l.dmarcRecord,
          bounceRate: l.bounceRate, complaintRate: l.complaintRate, openRate: l.openRate,
          score: l.score, blacklists: l.blacklists ?? [], createdAt: l.createdAt,
        });
      }
    }
    setBusy(false);
  }

  const listed = snap?.blacklists.filter((b) => b.listed) ?? [];

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Domain Health</h1>
          <p className="ec-flows-sub">Deliverability for {domain}{snap ? ` · checked ${new Date(snap.createdAt).toLocaleString()}` : ""}</p>
        </div>
        {isAdmin ? (
          <button className="ec-btn ec-btn-primary" disabled={busy} onClick={() => void recheck()}>
            {busy ? "Checking..." : "Re-check now"}
          </button>
        ) : null}
      </div>

      {!snap ? (
        <div className="ec-empty" style={{ paddingTop: 50 }}>
          <div className="ec-empty-title">No health check yet</div>
          <div className="ec-empty-sub">{isAdmin ? "Run the first check with Re-check now." : "An admin can run the first check."}</div>
        </div>
      ) : (
        <>
          <div className="ec-health-top">
            <div className="ec-health-gauge">
              <div className="ec-health-score">{snap.score}</div>
              <div className="ec-health-grade">{grade(snap.score)}</div>
            </div>
            <div className="ec-stat-grid" style={{ flex: 1 }}>
              <div className="ec-stat-card"><div className="ec-stat-value">{snap.bounceRate}%</div><div className="ec-stat-label">Bounce rate</div></div>
              <div className="ec-stat-card"><div className="ec-stat-value">{snap.complaintRate}%</div><div className="ec-stat-label">Complaint rate</div></div>
              <div className="ec-stat-card"><div className="ec-stat-value">{snap.openRate}%</div><div className="ec-stat-label">Open rate (30d)</div></div>
              <div className="ec-stat-card"><div className="ec-stat-value">{listed.length === 0 ? "Clean" : String(listed.length)}</div><div className="ec-stat-label">Blacklists</div></div>
            </div>
          </div>

          <div className="ec-report-block">
            <div className="ec-report-block-title">Authentication</div>
            <div className="ec-flows-list" style={{ maxWidth: 720 }}>
              <AuthRow label="SPF" status={snap.spf} record={snap.spfRecord} fixHint={`Add a TXT record on ${domain}: v=spf1 include:_spf.resend.com ~all`} />
              <AuthRow label="DKIM" status={snap.dkim} record={null} fixHint="Add the Resend DKIM CNAME records shown in the Resend dashboard." />
              <AuthRow label="DMARC" status={snap.dmarc} record={snap.dmarcRecord} fixHint={`Add a TXT record on _dmarc.${domain}: v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`} />
            </div>
          </div>

          <div className="ec-report-block">
            <div className="ec-report-block-title">Blacklists</div>
            {snap.blacklists.length > 0 && listed.length === 0 ? (
              <p style={{ fontSize: "11.5px", color: "var(--ec-faint)", marginBottom: 8, marginTop: 0 }}>
                Domain-level checks only. Set SENDING_IP to monitor a dedicated sending IP.
              </p>
            ) : null}
            <div className="ec-flows-list" style={{ maxWidth: 720 }}>
              {snap.blacklists.map((b) => (
                <div key={b.zone} className="ec-flow-row">
                  <span className="ec-flow-main" style={{ fontSize: 13 }}>{b.zone}</span>
                  <span className={`ec-pill ${b.listed ? "ec-pill-danger" : "ec-pill-live"}`}>{b.listed ? "listed" : "clean"}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
