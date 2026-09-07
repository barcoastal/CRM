"use client";

import { useState } from "react";
import { toast } from "sonner";

interface Item {
  id: string;
  type: string;
  message: string;
  screenshot: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
}

const TYPE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  BUG: { label: "Bug", bg: "#fdecea", color: "#c23934" },
  PARITY: { label: "SF difference", bg: "#eef1f8", color: "#3052FF" },
  IDEA: { label: "Idea", bg: "#eaf5ec", color: "#2e844a" },
};

const STATUSES = [
  { value: "NEW", label: "New" },
  { value: "IN_PROGRESS", label: "Working on it" },
  { value: "DONE", label: "Done" },
  { value: "WONT_FIX", label: "Won't fix" },
];

// Three workflow tabs. "Done" also holds Won't-fix so nothing is orphaned.
const TABS = [
  { key: "NEW", label: "New", statuses: ["NEW"] },
  { key: "IN_PROGRESS", label: "Working on it", statuses: ["IN_PROGRESS"] },
  { key: "DONE", label: "Done", statuses: ["DONE", "WONT_FIX"] },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function FeedbackAdminList({ items: initial }: { items: Item[] }) {
  const [items, setItems] = useState(initial);
  const [typeFilter, setTypeFilter] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("NEW");
  const [zoomed, setZoomed] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    const res = await fetch(`/api/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
      toast.success("Status updated");
    } else {
      toast.error("Could not update status");
    }
  }

  const byType = items.filter((i) => !typeFilter || i.type === typeFilter);
  const tabStatuses = TABS.find((t) => t.key === activeTab)!.statuses as readonly string[];
  const visible = byType.filter((i) => tabStatuses.includes(i.status));

  return (
    <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4 }}>
      <div style={{ display: "flex", alignItems: "flex-end", padding: "0 16px", borderBottom: "1px solid #ecebea" }}>
        {TABS.map((t) => {
          const count = byType.filter((i) => (t.statuses as readonly string[]).includes(i.status)).length;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                background: "none",
                border: 0,
                borderBottom: active ? "2px solid #0176d3" : "2px solid transparent",
                padding: "12px 14px 10px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                color: active ? "#181818" : "#747474",
              }}
            >
              {t.label} <span style={{ fontSize: 11, color: "#747474" }}>({count})</span>
            </button>
          );
        })}
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ ...sel, marginLeft: "auto", marginBottom: 8 }}>
          <option value="">All types</option>
          <option value="BUG">Bugs</option>
          <option value="PARITY">SF differences</option>
          <option value="IDEA">Ideas</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "#747474" }}>
          Nothing in {TABS.find((t) => t.key === activeTab)!.label}.
        </div>
      ) : (
        visible.map((i) => {
          const t = TYPE_LABEL[i.type] ?? TYPE_LABEL.BUG;
          return (
            <div key={i.id} style={{ padding: "12px 16px", borderBottom: "1px solid #f3f3f3" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    padding: "1px 10px",
                    borderRadius: 10,
                    background: t.bg,
                    color: t.color,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {t.label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#181818" }}>{i.userName}</span>
                <span style={{ fontSize: 12, color: "#747474" }}>
                  {new Date(i.createdAt).toLocaleString("en-US", {
                    month: "numeric",
                    day: "numeric",
                    year: "2-digit",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <select
                  value={i.status}
                  onChange={(e) => void setStatus(i.id, e.target.value)}
                  style={{ ...sel, marginLeft: "auto" }}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 13, color: "#181818", whiteSpace: "pre-wrap", marginBottom: 4 }}>
                {i.message}
              </div>
              {i.screenshot && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={i.screenshot}
                  alt="Screenshot"
                  onClick={() => setZoomed(i.screenshot)}
                  style={{
                    display: "block",
                    maxWidth: 220,
                    maxHeight: 140,
                    border: "1px solid #c9c9c9",
                    borderRadius: 4,
                    cursor: "zoom-in",
                    margin: "6px 0",
                  }}
                />
              )}
              {i.pageUrl && (
                <a href={i.pageUrl} style={{ fontSize: 12, color: "#0176d3", wordBreak: "break-all" }}>
                  {i.pageUrl}
                </a>
              )}
            </div>
          );
        })
      )}
      {zoomed && (
        <div
          onClick={() => setZoomed(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8,7,7,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 24,
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomed} alt="Screenshot" style={{ maxWidth: "95%", maxHeight: "95%", borderRadius: 6 }} />
        </div>
      )}
    </div>
  );
}

const sel: React.CSSProperties = {
  height: 30,
  padding: "0 8px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
  background: "#fff",
};
