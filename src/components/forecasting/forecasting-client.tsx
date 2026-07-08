"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CategoryPicker } from "./category-picker";
import { SetQuotaModal } from "./set-quota-modal";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  FORECAST_CATEGORIES,
  type ForecastCategory,
} from "@/lib/forecasting/categories";
import { shiftPeriod } from "@/lib/forecasting/period";

type RollupRow = {
  userId: string;
  userName: string;
  amounts: Record<ForecastCategory, number>;
  count: number;
  total: number;
  quota: number | null;
  attainment: number | null;
};

type Summary = {
  totals: Record<ForecastCategory, number>;
  totalCount: number;
  totalQuota: number;
  grand: number;
  attainment: number | null;
};

type TopOpp = {
  id: string;
  name: string;
  ownerName: string;
  amount: number;
  closeDate: string | null;
  stage: string;
  category: ForecastCategory;
};

export function ForecastingClient({
  period,
  periodKind,
  forUserId,
  includeTeam,
  currentUserId,
  currentUserName,
  users,
  rows,
  summary,
  topOpps,
  periodLabel,
}: {
  period: string;
  periodKind: "month" | "quarter";
  forUserId: string | null;
  includeTeam: boolean;
  currentUserId: string;
  currentUserName: string;
  users: { id: string; name: string }[];
  rows: RollupRow[];
  summary: Summary;
  topOpps: TopOpp[];
  periodLabel: string;
}) {
  const router = useRouter();
  const [quotaOpen, setQuotaOpen] = useState(false);

  function pushFilters(opts: Partial<{ period: string; team: boolean; kind: "month" | "quarter"; forUserId: string | null }>) {
    const sp = new URLSearchParams();
    const nextPeriod = opts.period ?? period;
    const nextTeam = opts.team ?? includeTeam;
    const nextFor = opts.forUserId !== undefined ? opts.forUserId : forUserId;
    sp.set("period", nextPeriod);
    sp.set("team", nextTeam ? "1" : "0");
    if (nextFor) sp.set("forUserId", nextFor);
    else sp.set("forUserId", "ALL");
    router.push(`/forecasting?${sp.toString()}`);
  }

  function todayPeriod() {
    const now = new Date();
    if (periodKind === "month") {
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    }
    const y = now.getUTCFullYear();
    const q = Math.floor(now.getUTCMonth() / 3) + 1;
    return `${y}-Q${q}`;
  }

  function switchKind(kind: "month" | "quarter") {
    if (kind === periodKind) return;
    const now = new Date();
    const y = now.getUTCFullYear();
    if (kind === "month") {
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      pushFilters({ period: `${y}-${m}`, kind });
    } else {
      const q = Math.floor(now.getUTCMonth() / 3) + 1;
      pushFilters({ period: `${y}-Q${q}`, kind });
    }
  }

  const quotaPct =
    summary.totalQuota > 0 ? Math.min(100, (summary.totals.CLOSED / summary.totalQuota) * 100) : 0;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#181818", margin: 0 }}>Forecasting</h1>
          <div style={{ fontSize: 13, color: "#747474", marginTop: 4 }}>
            Pipeline by category for {periodLabel}
            {forUserId && includeTeam ? `, ${currentUserName} and team` : ""}
            {forUserId && !includeTeam ? `, ${currentUserName}` : ""}
            {!forUserId ? `, all reps` : ""}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Period kind toggle */}
          <div style={{ display: "inline-flex", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "hidden" }}>
            {(["month", "quarter"] as const).map((k) => (
              <button
                key={k}
                onClick={() => switchKind(k)}
                style={{
                  background: periodKind === k ? "#3052ff" : "#fff",
                  color: periodKind === k ? "#fff" : "#3052ff",
                  border: 0,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Period nav */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => pushFilters({ period: shiftPeriod(period, -1) })} style={navBtn} aria-label="Previous period">
              ◀
            </button>
            <button onClick={() => pushFilters({ period: todayPeriod() })} style={{ ...navBtn, padding: "6px 12px" }}>
              Today
            </button>
            <button onClick={() => pushFilters({ period: shiftPeriod(period, 1) })} style={navBtn} aria-label="Next period">
              ▶
            </button>
          </div>

          {/* Scope toggle */}
          <select
            value={forUserId ? (includeTeam ? "team" : "me") : "all"}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "all") pushFilters({ forUserId: null });
              else if (v === "me") pushFilters({ forUserId: currentUserId, team: false });
              else pushFilters({ forUserId: currentUserId, team: true });
            }}
            style={{ ...inp, fontWeight: 600 }}
          >
            <option value="me">My Opportunities</option>
            <option value="team">My Team</option>
            <option value="all">All Reps</option>
          </select>

          <button onClick={() => setQuotaOpen(true)} style={btnPrimary}>
            + Set Quota
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {FORECAST_CATEGORIES.map((c) => (
          <div key={c} style={{ ...card, padding: 16, borderLeft: `4px solid ${CATEGORY_COLOR[c]}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#747474", textTransform: "uppercase", letterSpacing: 0.4 }}>
              {CATEGORY_LABEL[c]}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#181818", marginTop: 6 }}>
              {fmtMoney(summary.totals[c])}
            </div>
          </div>
        ))}
      </div>

      {/* Quota progress */}
      <div style={{ ...card, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#181818" }}>
              Quota Attainment, {periodLabel}
            </div>
            <div style={{ fontSize: 11, color: "#747474", marginTop: 2 }}>
              {summary.totalQuota > 0
                ? `${fmtMoney(summary.totals.CLOSED)} of ${fmtMoney(summary.totalQuota)} closed`
                : "No quota set for this period"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {summary.totalQuota > 0 ? (
              <div style={{ fontSize: 20, fontWeight: 700, color: quotaPct >= 100 ? "#1a7d37" : "#181818" }}>
                {quotaPct.toFixed(1)}%
              </div>
            ) : (
              <button onClick={() => setQuotaOpen(true)} style={btnPrimary}>
                Set Quota
              </button>
            )}
          </div>
        </div>
        <div
          style={{
            position: "relative",
            height: 10,
            background: "#ecebea",
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${quotaPct}%`,
              background: quotaPct >= 100 ? "#1a7d37" : "#3052ff",
              transition: "width .2s",
            }}
          />
        </div>
      </div>

      {/* Rollup table */}
      <div style={{ ...card, padding: 0, marginBottom: 20, overflowX: "auto" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #ecebea", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#181818" }}>
            Rollup by Rep
          </div>
          <div style={{ fontSize: 11, color: "#747474" }}>
            {rows.length} {rows.length === 1 ? "rep" : "reps"}, {summary.totalCount} opps
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafaf9", color: "#444444", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={th}>Rep</th>
              {FORECAST_CATEGORIES.map((c) => (
                <th key={c} style={{ ...th, textAlign: "right", color: CATEGORY_COLOR[c] }}>
                  {CATEGORY_LABEL[c]}
                </th>
              ))}
              <th style={{ ...th, textAlign: "right" }}>Total</th>
              <th style={{ ...th, textAlign: "right" }}>Quota</th>
              <th style={{ ...th, textAlign: "right" }}>Attain</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: "center", color: "#747474" }}>
                  No opportunities in this period.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.userId} style={{ borderTop: "1px solid #ecebea" }}>
                <td style={td}>
                  <button
                    onClick={() => pushFilters({ forUserId: r.userId, team: false })}
                    style={{ background: "transparent", border: 0, color: "#3052ff", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 13 }}
                  >
                    {r.userName}
                  </button>
                  <div style={{ fontSize: 11, color: "#747474" }}>{r.count} opps</div>
                </td>
                {FORECAST_CATEGORIES.map((c) => (
                  <td key={c} style={{ ...td, textAlign: "right", color: r.amounts[c] > 0 ? "#181818" : "#a8a8a8" }}>
                    {fmtMoney(r.amounts[c])}
                  </td>
                ))}
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmtMoney(r.total)}</td>
                <td style={{ ...td, textAlign: "right", color: "#747474" }}>
                  {r.quota != null ? fmtMoney(r.quota) : "—"}
                </td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600, color: attainmentColor(r.attainment) }}>
                  {r.attainment != null ? `${(r.attainment * 100).toFixed(0)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pipeline change waterfall */}
      <div style={{ ...card, padding: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #ecebea" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#181818" }}>
            Top Pipeline Changes
          </div>
          <div style={{ fontSize: 11, color: "#747474", marginTop: 2 }}>
            Largest Commit and Best Case opportunities in {periodLabel}. Override the category inline.
          </div>
        </div>
        {topOpps.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#747474", fontSize: 13 }}>
            No Commit or Best Case opps for this period.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fafaf9", color: "#444444", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={th}>Opportunity</th>
                <th style={th}>Owner</th>
                <th style={{ ...th, textAlign: "right" }}>Amount</th>
                <th style={th}>Close Date</th>
                <th style={th}>Stage</th>
                <th style={th}>Category</th>
              </tr>
            </thead>
            <tbody>
              {topOpps.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid #ecebea" }}>
                  <td style={td}>
                    <Link href={`/opportunities/${o.id}`} style={{ color: "#3052ff", fontWeight: 600, textDecoration: "none" }}>
                      {o.name || `Opportunity ${o.id.slice(-6)}`}
                    </Link>
                  </td>
                  <td style={{ ...td, color: "#747474" }}>{o.ownerName}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmtMoney(o.amount)}</td>
                  <td style={{ ...td, color: "#747474" }}>{o.closeDate || "—"}</td>
                  <td style={{ ...td, color: "#747474", fontSize: 12 }}>{o.stage}</td>
                  <td style={td}>
                    <CategoryPicker opportunityId={o.id} value={o.category} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SetQuotaModal
        open={quotaOpen}
        onClose={() => setQuotaOpen(false)}
        defaultUserId={forUserId || currentUserId}
        defaultPeriod={period}
        users={users}
      />
    </div>
  );
}

function fmtMoney(n: number) {
  if (!n || n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function attainmentColor(a: number | null): string {
  if (a == null) return "#a8a8a8";
  if (a >= 1) return "#1a7d37";
  if (a >= 0.7) return "#b48c00";
  return "#c23934";
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ecebea",
  borderRadius: 6,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const inp: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  fontSize: 12,
  outline: "none",
  background: "#fff",
  color: "#181818",
  cursor: "pointer",
};

const navBtn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 600,
  color: "#3052ff",
  cursor: "pointer",
};

const btnPrimary: React.CSSProperties = {
  background: "#3052ff",
  color: "#fff",
  border: 0,
  borderRadius: 4,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontWeight: 700,
};

const td: React.CSSProperties = {
  padding: "10px 14px",
  verticalAlign: "top",
};
