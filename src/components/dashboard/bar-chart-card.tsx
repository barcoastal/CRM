"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface BarDatum {
  label: string;
  count: number;
  amount: number;
}

function shortMoney(n: number): string {
  if (!n || !Number.isFinite(n)) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

export function BarChartCard({
  title,
  subtitle,
  data,
  reportLink,
  asOf,
  showAmount = true,
}: {
  title: string;
  subtitle?: string;
  data: BarDatum[];
  reportLink?: string;
  asOf?: string;
  showAmount?: boolean;
}) {
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
      <div style={{ padding: 8, flex: 1, minHeight: 260 }}>
        <div style={{ textAlign: "center", fontSize: 11, color: "#706e6b", marginBottom: 2 }}>
          {showAmount ? "Record Count vs Total Debt" : "Record Count"}
        </div>
        <ResponsiveContainer width="100%" height={290}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid stroke="#f3f3f3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "#706e6b" }}
              axisLine={{ stroke: "#dddbda" }}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 10, fill: "#3e3e3c" }}
              axisLine={{ stroke: "#dddbda" }}
              width={140}
              interval={0}
            />
            <Tooltip
              formatter={(value, name) => {
                const num = typeof value === "number" ? value : Number(value) || 0;
                if (name === "amount" || name === "Total Debt") {
                  return [shortMoney(num), "Total Debt"];
                }
                return [num.toLocaleString(), "Count"];
              }}
            />
            {showAmount ? <Legend wrapperStyle={{ fontSize: 10 }} /> : null}
            <Bar dataKey="count" name="Count" fill="#1589ee" isAnimationActive={false} />
            {showAmount ? (
              <Bar dataKey="amount" name="Total Debt" fill="#16325c" isAnimationActive={false} />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
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
