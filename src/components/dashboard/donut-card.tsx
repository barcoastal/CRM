"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// SF Manager Dashboard donut: counts by category with a legend below.
// Colors mirror the SF chart palette (blue / dark blue / red / yellow / green).
const DONUT_COLORS = [
  "#1589ee",
  "#0070d2",
  "#16325c",
  "#c23934",
  "#ffb75d",
  "#04844b",
  "#706e6b",
  "#5867e8",
  "#dd7a01",
  "#54698d",
];

export interface DonutSlice {
  label: string;
  count: number;
}

export function DonutCard({
  title,
  subtitle,
  data,
  metricLabel = "Record Count",
  reportLink,
  asOf,
}: {
  title: string;
  subtitle?: string;
  data: DonutSlice[];
  metricLabel?: string;
  reportLink?: string;
  asOf?: string;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #dddbda",
        borderRadius: 4,
        display: "flex",
        flexDirection: "column",
        minHeight: 360,
      }}
    >
      <header
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #dddbda",
          background: "#fafaf9",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "#080707" }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 11, color: "#706e6b" }}>{subtitle}</div>
        ) : null}
      </header>
      <div style={{ padding: 8, flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ textAlign: "center", fontSize: 11, color: "#706e6b", marginBottom: 2 }}>
          {metricLabel}
        </div>
        <div style={{ flex: 1, minHeight: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(value, _name, entry) => {
                  const num = typeof value === "number" ? value : 0;
                  const label =
                    (entry && (entry as { payload?: { label?: string } }).payload?.label) || "";
                  const pct = total > 0 ? Math.round((num / total) * 1000) / 10 : 0;
                  return [`${num.toLocaleString()} (${pct}%)`, label];
                }}
              />
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={1}
                isAnimationActive={false}
                label={(props) => {
                  const count = (props as { count?: number }).count ?? 0;
                  if (total === 0 || count / total <= 0.04) return "";
                  const pct = Math.round((count / total) * 1000) / 10;
                  return `${count.toLocaleString()} (${pct}%)`;
                }}
                labelLine={false}
              >
                {data.map((entry, idx) => (
                  <Cell key={entry.label} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            padding: "8px 4px",
          }}
        >
          {data.slice(0, 8).map((entry, idx) => (
            <div
              key={entry.label}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#3e3e3c" }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  background: DONUT_COLORS[idx % DONUT_COLORS.length],
                  display: "inline-block",
                  borderRadius: 2,
                }}
              />
              <span style={{ whiteSpace: "nowrap" }}>{entry.label}</span>
            </div>
          ))}
        </div>
      </div>
      <footer
        style={{
          borderTop: "1px solid #dddbda",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#706e6b",
          background: "#fafaf9",
        }}
      >
        {reportLink ? (
          <a
            href={reportLink}
            style={{ color: "#0070d2", textDecoration: "none", fontWeight: 600 }}
          >
            View Report ({title})
          </a>
        ) : (
          <span>View Report ({title})</span>
        )}
        <span>{asOf ?? ""}</span>
      </footer>
    </div>
  );
}
