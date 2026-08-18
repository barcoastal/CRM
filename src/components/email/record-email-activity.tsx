"use client";

/**
 * Email Activity panel for record detail pages (lead/account/contact). Lists
 * every email on the record with open/click status and its source. Self-loads
 * from /api/email-center/reports/record-activity.
 */
import { useEffect, useState } from "react";

interface Item {
  id: string;
  direction: string;
  subject: string;
  status: string;
  counterparty: string;
  openCount: number;
  clickCount: number;
  at: string;
  source: string;
}

export function RecordEmailActivity({ entity, id }: { entity: "lead" | "account" | "contact"; id: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/email-center/reports/record-activity?entity=${entity}&id=${id}`)
      .then((r) => r.json())
      .then((d) => { if (active) { setItems(d.items ?? []); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [entity, id]);

  if (loading) return <div style={{ padding: 12, fontSize: 13, color: "#706e6b" }}>Loading email activity...</div>;
  if (items.length === 0) return <div style={{ padding: 12, fontSize: 13, color: "#706e6b" }}>No email activity yet.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((m) => (
        <div
          key={m.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            border: "1px solid #e6e6e3",
            borderRadius: 8,
            background: "#fff",
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.subject}
            </span>
            <span style={{ display: "block", fontSize: 11, color: "#9c9c97" }}>
              {m.direction === "INBOUND" ? "From" : "To"} {m.counterparty} · {m.source}
            </span>
          </span>
          {m.openCount > 0 ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#0e5c31" }}>{m.openCount} opens</span>
          ) : null}
          {m.clickCount > 0 ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#0e5c31" }}>{m.clickCount} clicks</span>
          ) : null}
          <span style={{ fontSize: 11, color: "#706e6b" }}>{new Date(m.at).toLocaleDateString()}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "lowercase",
              color: m.status === "FAILED" || m.status === "BOUNCED" ? "#b3261e" : "#6e6e6a",
            }}
          >
            {m.status.toLowerCase()}
          </span>
        </div>
      ))}
    </div>
  );
}
