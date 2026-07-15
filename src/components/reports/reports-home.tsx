"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * SF Reports home, 1:1: left rail sections (REPORTS / FOLDERS / FAVORITES),
 * search box, New Report + New Folder buttons, and the report table with
 * Report Name | Description | Folder | Created By | Created On | Subscribed.
 */
export interface ReportRow {
  id: string;
  name: string;
  description: string | null;
  folder: string;
  objectType: string;
  createdById: string | null;
  createdByName: string;
  createdAt: string;
  lastRunAt: string | null;
  isShared: boolean;
}

type RailKey =
  | "recent"
  | "created-by-me"
  | "private"
  | "public"
  | "all"
  | `folder:${string}`
  | "favorites";

export function ReportsHome({ reports, folders, myId }: { reports: ReportRow[]; folders: string[]; myId: string | null }) {
  const router = useRouter();
  const [rail, setRail] = useState<RailKey>("recent");
  const [q, setQ] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const railLabel: Record<string, string> = {
    recent: "Recent",
    "created-by-me": "Created by Me",
    private: "Private Reports",
    public: "Public Reports",
    all: "All Reports",
    favorites: "All Favorites",
  };

  const visible = useMemo(() => {
    let list = [...reports];
    if (rail === "recent") list.sort((a, b) => (b.lastRunAt ?? b.createdAt).localeCompare(a.lastRunAt ?? a.createdAt));
    if (rail === "created-by-me") list = list.filter((r) => r.createdById && r.createdById === myId);
    if (rail === "private") list = list.filter((r) => !r.isShared);
    if (rail === "public") list = list.filter((r) => r.isShared);
    if (rail === "favorites") list = [];
    if (rail.startsWith("folder:")) list = list.filter((r) => r.folder === rail.slice(7));
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(needle) || (r.description ?? "").toLowerCase().includes(needle));
    }
    return list;
  }, [reports, rail, q, myId]);

  async function newFolder() {
    const name = prompt("Folder name");
    if (!name?.trim()) return;
    const res = await fetch("/api/reports/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) { toast.success("Folder created"); router.refresh(); }
    else toast.error((await res.json().catch(() => ({}))).error ?? "Failed");
  }

  async function del(id: string) {
    if (!confirm("Delete this report?")) return;
    const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Report deleted"); router.refresh(); }
    else toast.error("Delete failed");
  }

  const railItem = (key: RailKey, label: string) => (
    <button
      key={key}
      onClick={() => setRail(key)}
      style={{
        display: "block", width: "100%", textAlign: "left", padding: "6px 16px",
        fontSize: 13, border: 0, cursor: "pointer", borderRadius: 4,
        background: rail === key ? "#f3f2f2" : "transparent",
        color: rail === key ? "#0176d3" : "#181818",
        fontWeight: rail === key ? 700 : 400,
      }}
    >
      {label}
    </button>
  );

  const th: React.CSSProperties = { textAlign: "left", padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#444444", borderBottom: "1px solid #c9c9c9", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "8px 12px", fontSize: 13, color: "#181818", borderBottom: "1px solid #f3f3f3" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 0, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 8, overflow: "hidden", minHeight: 560 }}>
      {/* Left rail */}
      <div style={{ borderRight: "1px solid #e5e5e5", padding: "12px 0" }}>
        <div style={{ padding: "0 16px 6px", fontSize: 11, fontWeight: 700, color: "#747474", letterSpacing: 0.6 }}>REPORTS</div>
        {railItem("recent", "Recent")}
        {railItem("created-by-me", "Created by Me")}
        {railItem("private", "Private Reports")}
        {railItem("public", "Public Reports")}
        {railItem("all", "All Reports")}
        <div style={{ padding: "14px 16px 6px", fontSize: 11, fontWeight: 700, color: "#747474", letterSpacing: 0.6 }}>FOLDERS</div>
        {folders.map((f) => railItem(`folder:${f}` as RailKey, f))}
        <div style={{ padding: "14px 16px 6px", fontSize: 11, fontWeight: 700, color: "#747474", letterSpacing: 0.6 }}>FAVORITES</div>
        {railItem("favorites", "All Favorites")}
      </div>

      {/* Main */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #e5e5e5" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "#444444" }}>Reports</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#181818" }}>
              {rail.startsWith("folder:") ? rail.slice(7) : railLabel[rail]}
            </div>
            <div style={{ fontSize: 12, color: "#747474" }}>{visible.length} item{visible.length === 1 ? "" : "s"}</div>
          </div>
          <input
            placeholder={`Search ${rail.startsWith("folder:") ? "this folder" : "reports"}...`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: 260, height: 32, padding: "0 12px", border: "1px solid #c9c7c5", borderRadius: 16, fontSize: 13 }}
          />
          <Link href="/reports/new" className="slds-button slds-button_neutral" style={{ whiteSpace: "nowrap" }}>New Report</Link>
          <button onClick={newFolder} className="slds-button slds-button_neutral" style={{ whiteSpace: "nowrap", cursor: "pointer" }}>New Folder</button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9" }}>
              <th style={th}>Report Name</th>
              <th style={th}>Description</th>
              <th style={th}>Folder</th>
              <th style={th}>Created By</th>
              <th style={th}>Created On</th>
              <th style={th}>Subscribed</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, padding: 32, textAlign: "center", color: "#747474" }}>No reports here.</td></tr>
            )}
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  <Link href={`/reports/${r.id}`} style={{ color: "#0176d3", fontWeight: 600 }}>{r.name}</Link>
                </td>
                <td style={{ ...td, color: "#444444", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description ?? ""}</td>
                <td style={td}>{r.folder}</td>
                <td style={td}>{r.createdByName}</td>
                <td style={td}>{new Date(r.createdAt).toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td style={td}></td>
                <td style={{ ...td, position: "relative" }}>
                  <button
                    aria-label="Report actions"
                    onClick={() => setMenuFor((c) => (c === r.id ? null : r.id))}
                    style={{ border: "1px solid #c9c9c9", background: "#fff", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 13, lineHeight: 1 }}
                  >
                    ▾
                  </button>
                  {menuFor === r.id && (
                    <div style={{ position: "absolute", right: 8, top: "100%", zIndex: 20, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", minWidth: 120 }}>
                      <Link href={`/reports/${r.id}`} style={menuItem}>Run</Link>
                      <Link href={`/reports/builder?objectType=${r.objectType}&id=${r.id}`} style={menuItem}>Edit</Link>
                      <button style={{ ...menuItem, color: "#c23934", width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer" }} onClick={() => void del(r.id)}>Delete</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const menuItem: React.CSSProperties = { display: "block", padding: "8px 12px", fontSize: 13, color: "#181818", textDecoration: "none" };
