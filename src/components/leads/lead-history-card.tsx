import { RelatedList } from "@/components/slds/related-list";

export type HistoryRow = {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: { name: string | null } | null;
  changedAt: Date | string;
};

/**
 * SF Audit History card — a 5-column related list of the most recent
 * field-level changes to a record. Used on the Lead "Related" tab and the
 * Account / Contact / Opportunity equivalents.
 *
 * Columns: Date | User | Field | Old Value | New Value (mirrors the SF
 * "Stage History" / "Field History Tracking" component).
 */
export function LeadHistoryCard({
  rows,
  entityLabel = "Audit History",
  emptyHint = "No changes recorded yet.",
}: {
  rows: HistoryRow[];
  entityLabel?: string;
  emptyHint?: string;
}) {
  return (
    <RelatedList
      entity="Account"
      title={`${entityLabel} (${rows.length})`}
      items={rows}
      emptyHint={emptyHint}
      renderItem={(h: HistoryRow) => (
        <div style={grid}>
          <div style={cell}>{new Date(h.changedAt).toLocaleString()}</div>
          <div style={cell}>{h.changedBy?.name ?? "System"}</div>
          <div style={cell}>{prettifyFieldName(h.field)}</div>
          <div style={{ ...cell, color: "#706e6b" }}>{display(h.oldValue)}</div>
          <div style={cell}>{display(h.newValue)}</div>
        </div>
      )}
    />
  );
}

function display(v: string | null): string {
  if (v == null) return "-";
  const s = v.trim();
  if (!s) return "-";
  return s.length > 80 ? s.slice(0, 80) + "..." : s;
}

/** Strip SF's __c suffix + convert snake_case to spaced. */
function prettifyFieldName(field: string): string {
  return field
    .replace(/__c$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "160px 140px 160px 1fr 1fr",
  gap: 12,
  alignItems: "center",
};

const cell: React.CSSProperties = {
  fontSize: 12,
  color: "#080707",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
