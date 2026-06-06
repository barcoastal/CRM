/**
 * Right-rail "Reports" card — SF shows a list of saved reports attached to
 * the Opportunity (e.g. "Payment Calculator Drafts" with a "View Report"
 * link). We mirror it with deterministic links into our own pages so the rail
 * doesn't look empty next to SF.
 *
 * SF reference: docs/sf-screenshots/sf-opp-kenya.png "Reports" block.
 */

import Link from "next/link";

export function OppReportsCard({ opportunityId }: { opportunityId: string }) {
  const reports = [
    {
      label: "Payment Calculator Drafts",
      href: `/opportunities/${opportunityId}?tab=Payment+Calculator`,
    },
    {
      label: "Debt Information",
      href: `/opportunities/${opportunityId}?tab=Debt+Information`,
    },
    {
      label: "Settlements",
      href: `/opportunities/${opportunityId}?tab=Settlements`,
    },
  ];
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #dddbda",
        borderRadius: 4,
        marginBottom: 12,
        boxShadow: "0 2px 2px 0 rgba(0,0,0,0.05)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: "#fafaf9",
          borderBottom: "1px solid #ecebea",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: "#706e6b", transform: "rotate(90deg)" }}>
          <path d="M2 0l6 5-6 5z" />
        </svg>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#080707", margin: 0 }}>
          Reports
        </h3>
      </header>
      <ul style={{ listStyle: "none", padding: "4px 12px 8px", margin: 0 }}>
        {reports.map((r) => (
          <li
            key={r.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 0",
              borderBottom: "1px solid #f3f2f2",
              fontSize: 12,
            }}
          >
            <span style={{ color: "#080707" }}>{r.label}</span>
            <Link href={r.href} style={{ color: "#0070d2", fontSize: 12 }}>
              View Report
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
