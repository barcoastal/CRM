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
        border: "1px solid #d8dde6",
        borderRadius: 4,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#080707" }}>
        Reports
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {reports.map((r) => (
          <li
            key={r.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 0",
              borderBottom: "1px solid #f3f3f3",
              fontSize: 12,
            }}
          >
            <span>{r.label}</span>
            <Link href={r.href} style={{ color: "#1589ee", fontSize: 12 }}>
              View Report
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
