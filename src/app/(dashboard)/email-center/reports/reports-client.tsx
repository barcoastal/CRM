"use client";

/**
 * Email Center reports overview: headline rate cards, a daily send-volume bar
 * chart (pure CSS, no chart lib), and a top-clicked-URLs table. Admins get a
 * date-range + user filter; non-admins see only their own numbers.
 */
import { useCallback, useEffect, useState } from "react";

interface Overview {
  days: number;
  totals: {
    total: number; delivered: number; uniqueOpens: number; uniqueClicks: number;
    bounced: number; complained: number; unsubscribed: number; failed: number;
  };
  rates: {
    deliveryRate: number; openRate: number; clickRate: number; clickToOpenRate: number;
    bounceRate: number; complaintRate: number; unsubscribeRate: number;
  };
  trend: Array<{ day: string; count: number }>;
  topUrls: Array<{ url: string; count: number }>;
}

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

export function ReportsClient({
  me, isAdmin, users,
}: {
  me: { id: string; name: string };
  isAdmin: boolean;
  users: { id: string; name: string }[];
}) {
  const [days, setDays] = useState(30);
  const [viewUser, setViewUser] = useState<string>(isAdmin ? "all" : me.id);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ days: String(days) });
    if (isAdmin && viewUser !== "all") qs.set("user", viewUser);
    const res = await fetch(`/api/email-center/reports/overview?${qs}`);
    const json = await res.json().catch(() => null);
    setData(res.ok ? json : null);
    setLoading(false);
  }, [days, viewUser, isAdmin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load flips loading before fetching, matching the app's inbox pattern
    void load();
  }, [load]);

  const maxTrend = data ? Math.max(1, ...data.trend.map((t) => t.count)) : 1;

  const cards = data
    ? [
        { label: "Sent", value: String(data.totals.total) },
        { label: "Delivery rate", value: `${data.rates.deliveryRate}%` },
        { label: "Open rate", value: `${data.rates.openRate}%` },
        { label: "Click rate", value: `${data.rates.clickRate}%` },
        { label: "Click-to-open", value: `${data.rates.clickToOpenRate}%` },
        { label: "Bounce rate", value: `${data.rates.bounceRate}%` },
        { label: "Unsubscribes", value: String(data.totals.unsubscribed) },
        { label: "Complaints", value: String(data.totals.complained) },
      ]
    : [];

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Reports</h1>
          <p className="ec-flows-sub">Delivery, open, and click performance across your email.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin ? (
            <select className="ec-select ec-select-sm" value={viewUser} onChange={(e) => setViewUser(e.target.value)}>
              <option value="all">All users</option>
              <option value={me.id}>My email</option>
              {users.filter((u) => u.id !== me.id).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          ) : null}
          <select className="ec-select ec-select-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((r) => (
              <option key={r.days} value={r.days}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="ec-stat-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ec-skel" style={{ height: 74 }} />
          ))}
        </div>
      ) : !data || data.totals.total === 0 ? (
        <div className="ec-empty" style={{ paddingTop: 50 }}>
          <div className="ec-empty-title">No email activity yet</div>
          <div className="ec-empty-sub">Once campaigns and flows send mail, performance shows up here.</div>
        </div>
      ) : (
        <>
          <div className="ec-stat-grid">
            {cards.map((c) => (
              <div key={c.label} className="ec-stat-card">
                <div className="ec-stat-value">{c.value}</div>
                <div className="ec-stat-label">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="ec-report-block">
            <div className="ec-report-block-title">Daily send volume</div>
            <div className="ec-trend">
              {data.trend.map((t) => (
                <div key={t.day} className="ec-trend-col" title={`${t.day}: ${t.count}`}>
                  <div className="ec-trend-bar" style={{ height: `${Math.round((t.count / maxTrend) * 100)}%` }} />
                </div>
              ))}
            </div>
          </div>

          <div className="ec-report-block">
            <div className="ec-report-block-title">Top clicked links</div>
            {data.topUrls.length === 0 ? (
              <div className="ec-empty-sub" style={{ paddingLeft: 2 }}>No clicks recorded yet.</div>
            ) : (
              <div className="ec-flows-list" style={{ maxWidth: 720 }}>
                {data.topUrls.map((u) => (
                  <div key={u.url} className="ec-flow-row">
                    <span className="ec-flow-main" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.url}</span>
                    <span className="ec-pill ec-pill-neutral">{u.count} clicks</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
