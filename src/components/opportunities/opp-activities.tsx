"use client";

import { useMemo, useState } from "react";

type Activity = { id: string; type: string; subject: string; detail: string; date: string };
type SortKey = "date" | "type" | "subject" | "detail";
const columns: [SortKey, string][] = [["date", "Date"], ["type", "Type"], ["subject", "Subject"], ["detail", "Detail"]];

export function OppActivities({ items }: { items: Activity[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [ascending, setAscending] = useState(false);
  const rows = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return items.filter((item) => !search || [item.type, item.subject, item.detail, new Date(item.date).toLocaleString()].some((value) => value.toLocaleLowerCase().includes(search)))
      .sort((a, b) => {
        const comparison = sort === "date" ? Date.parse(a.date) - Date.parse(b.date) : a[sort].localeCompare(b[sort], undefined, { numeric: true, sensitivity: "base" });
        return (ascending ? comparison : -comparison) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
      });
  }, [items, query, sort, ascending]);

  function changeSort(key: SortKey) {
    setAscending(key === sort ? !ascending : key !== "date");
    setSort(key);
  }

  return <div>
    <p style={{ fontSize: 12, color: "#747474", margin: "0 0 12px" }}>Includes calls, emails, SMS and tasks from this opportunity and its originating lead.</p>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 12 }}>
      <input type="search" aria-label="Search this opportunity’s activities" placeholder="Search this opportunity’s activities…" value={query} onChange={(event) => setQuery(event.target.value)} style={{ width: 360, maxWidth: "100%", height: 34, border: "1px solid #c9c9c9", borderRadius: 4, padding: "0 12px", fontSize: 13 }} />
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
            <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{new Date(item.date).toLocaleString()}</td>
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
