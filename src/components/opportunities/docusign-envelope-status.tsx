/**
 * Right-rail DocuSign Envelope Status card.
 *
 * SF layout reference: docs/sf-screenshots/sf-opp-kenya.png — shows a compact
 * list of envelopes with green-check / red-x status icons and the action that
 * happened ("Signed - Envelope Completed", "Envelope Voided" etc) plus a
 * relative timestamp.
 *
 * Behavior:
 *  - Hidden when there are no envelopes (SF shows the block only when there
 *    is at least one envelope row).
 *  - Up to 5 envelopes inline + "View All" link that scrolls down to the
 *    full envelopes related list in the Documents tab.
 */

import Link from "next/link";

export interface EnvelopeRow {
  id: string;
  templateName: string | null;
  documentName: string | null;
  status: string;
  signerName: string;
  sentAt: string | null;
  signedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

function statusIcon(status: string): { glyph: string; color: string; label: string } {
  const s = (status || "").toUpperCase();
  if (s.includes("VOID")) return { glyph: "x", color: "#c23934", label: "Envelope Voided" };
  if (s.includes("DECLIN")) return { glyph: "x", color: "#c23934", label: "Declined" };
  if (s.includes("COMPLET")) return { glyph: "v", color: "#04844b", label: "Envelope Completed" };
  if (s.includes("SIGN")) return { glyph: "v", color: "#04844b", label: "Signed" };
  if (s.includes("SENT")) return { glyph: "o", color: "#747474", label: "Sent" };
  return { glyph: "o", color: "#747474", label: status || "Pending" };
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours <= 0) return "just now";
    return `${hours}h ago`;
  }
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

export function DocusignEnvelopeStatus({
  envelopes,
}: {
  envelopes: EnvelopeRow[];
}) {
  if (!envelopes || envelopes.length === 0) return null;
  const top = envelopes.slice(0, 5);

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        marginBottom: 12,
        boxShadow: "0 2px 2px 0 rgba(0,0,0,0.05)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "#fafaf9",
          borderBottom: "1px solid #ecebea",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: "#747474", transform: "rotate(90deg)" }}>
            <path d="M2 0l6 5-6 5z" />
          </svg>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181818", margin: 0 }}>
            DocuSign Envelope Status
          </h3>
        </div>
        <span style={{ fontSize: 12, color: "#747474" }}>({envelopes.length})</span>
      </header>
      <ul style={{ listStyle: "none", padding: "4px 12px 4px", margin: 0 }}>
        {top.map((e) => {
          const icon = statusIcon(e.status);
          const when = e.completedAt ?? e.signedAt ?? e.sentAt ?? e.createdAt;
          return (
            <li
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "20px 1fr auto",
                gap: 8,
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid #f3f3f3",
                fontSize: 12,
              }}
            >
              <span
                aria-label={icon.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  borderRadius: 2,
                  background: icon.color,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 10,
                  textTransform: "uppercase",
                }}
              >
                {icon.glyph}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    color: "#181818",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {icon.label}
                </div>
                <div
                  style={{
                    color: "#747474",
                    fontSize: 11,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.templateName ?? e.documentName ?? e.signerName}
                </div>
              </div>
              <span style={{ color: "#747474", fontSize: 11, whiteSpace: "nowrap" }}>
                {timeAgo(when)}
              </span>
            </li>
          );
        })}
      </ul>
      {envelopes.length > top.length && (
        <div style={{ textAlign: "center", padding: "8px 12px", borderTop: "1px solid #ecebea" }}>
          <Link href="#envelopes" style={{ color: "#0176d3", fontSize: 12 }}>
            View All ({envelopes.length})
          </Link>
        </div>
      )}
    </article>
  );
}
