"use client";

import Link from "next/link";

export interface KeyDeal {
  id: string;
  name: string | null;
  stage: string;
  amount: number | null;
  currentTotalDebt: number | null;
  totalDebt: number | null;
  updatedAt: string;
  account: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
}

function fmtMoney(n: number | null | undefined): string {
  if (!n) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function KeyDealsCard({ deals }: { deals: KeyDeal[] }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
      }}
    >
      <header
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #c9c9c9",
          background: "#fafaf9",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 52 52" style={{ fill: "#fcb95b" }}>
          <use xlinkHref="/slds/icons/standard-sprite/svg/symbols.svg#opportunity" />
        </svg>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#181818" }}>
          Key Deals — Recent Opportunities
        </div>
      </header>
      {deals.length === 0 ? (
        <div style={{ padding: 16, textAlign: "center", color: "#747474", fontSize: 12 }}>
          No recent opportunities yet.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {deals.map((d) => {
            const amount = d.amount ?? d.currentTotalDebt ?? d.totalDebt ?? 0;
            return (
              <li
                key={d.id}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid #f3f3f3",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 4,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Link
                    href={`/opportunities/${d.id}`}
                    style={{
                      color: "#0176d3",
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                      display: "block",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {d.name || d.account?.name || "(no name)"}
                  </Link>
                  <div style={{ fontSize: 11, color: "#747474", marginTop: 2 }}>
                    {d.account?.name ?? "—"} · {d.assignedTo?.name ?? "Unassigned"} · {d.stage}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#181818",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    alignSelf: "center",
                  }}
                >
                  {fmtMoney(amount)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <footer
        style={{
          borderTop: "1px solid #c9c9c9",
          padding: "6px 12px",
          fontSize: 11,
          textAlign: "center",
          color: "#0176d3",
          fontWeight: 600,
          background: "#fafaf9",
        }}
      >
        <Link href="/opportunities" style={{ color: "#0176d3", textDecoration: "none" }}>
          View All Key Deals
        </Link>
      </footer>
    </div>
  );
}
