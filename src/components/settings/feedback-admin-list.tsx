"use client";

import { useState } from "react";
import { toast } from "sonner";

interface Item {
  id: string;
  type: string;
  message: string;
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
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
  { value: "WONT_FIX", label: "Won't fix" },
];

export function FeedbackAdminList({ items: initial }: { items: Item[] }) {
  const [items, setItems] = useState(initial);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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

  const visible = items.filter(
    (i) => (!typeFilter || i.type === typeFilter) && (!statusFilter || i.status === statusFilter),
  );

  return (
    <div style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4 }}>
      <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid #ecebea" }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={sel}>
          <option value="">All types</option>
          <option value="BUG">Bugs</option>
          <option value="PARITY">SF differences</option>
          <option value="IDEA">Ideas</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={sel}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#747474", alignSelf: "center" }}>
          {visible.length} shown
        </span>
      </div>

      {visible.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "#747474" }}>
          No feedback yet.
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
              {i.pageUrl && (
                <a href={i.pageUrl} style={{ fontSize: 12, color: "#0176d3", wordBreak: "break-all" }}>
                  {i.pageUrl}
                </a>
              )}
            </div>
          );
        })
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
