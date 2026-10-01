"use client";

import { useMemo, useState } from "react";
import { formatActivityDate } from "@/lib/activity-presentation";

type Activity = { id: string; type: string; subject: string; detail: string; date: string };
type SortKey = "date" | "type" | "subject" | "detail";
const columns: [SortKey, string][] = [["date", "Date"], ["type", "Type"], ["subject", "Subject"], ["detail", "Detail"]];

export function OppActivities({ items, context = "opportunity" }: { items: Activity[]; context?: "opportunity" | "account" }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [ascending, setAscending] = useState(false);
  const rows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return items.filter((item) => (!type || item.type === type) && (!search || [item.type, item.subject, item.detail, formatActivityDate(item.date)].some((value) => value.toLocaleLowerCase().includes(search))))
      .sort((a, b) => {
        const comparison = sort === "date" ? Date.parse(a.date) - Date.parse(b.date) : a[sort].localeCompare(b[sort], undefined, { numeric: true, sensitivity: "base" });
        return (ascending ? comparison : -comparison) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
      });
  }, [items, query, type, sort, ascending]);

  function changeSort(key: SortKey) {
    setAscending(key === sort ? !ascending : key !== "date");
    setSort(key);
  }

  return <div>
    <p style={{ fontSize: 12, color: "#747474", margin: "0 0 12px" }}>Includes calls, emails, SMS, tasks and notifications from {context === "opportunity" ? "this opportunity and its originating lead" : "this account"}. Times are Eastern.</p>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <input type="search" aria-label={`Search this ${context}’s activities`} placeholder={`Search this ${context}’s activities…`} value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 360, maxWidth: "100%", height: 34, border: "1px solid #c9c9c9", borderRadius: 4, padding: "0 12px", fontSize: 13 }} />
      <select aria-label="Activity type" value={type} onChange={event => setType(event.target.value)} style={{ height: 34, border: "1px solid #c9c9c9", borderRadius: 4, padding: "0 8px", fontSize: 13 }}>
        <option value="">All activity types</option>
        {[...new Set(items.map(item => item.type))].sort().map(value => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}
      </select>
      <span role="status" style={{ fontSize: 12, color: "#747474" }}>{rows.length} of {items.length} activities</span>
      {query && <button onClick={() => setQuery("")} style={{ background: "none", border: 0, color: "#0176d3", cursor: "pointer" }}>Clear search</button>}
    </div>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
          {columns.map(([key, name]) => <th key={key} aria-sort={sort === key ? ascending ? "ascending" : "descending" : "none"} style={{ textAlign: "left" }}>
            <button onClick={() => changeSort(key)} aria-label={`Sort by ${name}`} style={{ width: "100%", textAlign: "left", padding: "10px 12px", border: 0, background: "transparent", color: "#444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{name} <span aria-hidden="true" style={{ marginLeft: 6 }}>{sort === key ? ascending ? "↑" : "↓" : "↕"}</span></button>
          </th>)}
        </tr></thead>
        <tbody>
          {rows.map((item) => <tr key={item.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{formatActivityDate(item.date)}</td>
            <td style={{ padding: "10px 12px" }}>{item.type}</td>
            <td style={{ padding: "10px 12px", overflowWrap: "anywhere" }}>{item.subject}</td>
            <td style={{ padding: "10px 12px", overflowWrap: "anywhere" }}>{item.detail || "-"}</td>
          </tr>)}
          {!rows.length && <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#747474" }}>{items.length ? "No activities match your search." : "No activity recorded."}</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
