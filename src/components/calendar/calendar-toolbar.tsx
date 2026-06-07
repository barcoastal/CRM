"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { NewEventModal } from "@/components/quick-actions/new-event-modal";
import {
  type CalendarView,
  addDays,
  addMonths,
  formatRangeLabel,
} from "./calendar-helpers";

type UserOption = { id: string; name: string };

interface Props {
  view: CalendarView;
  anchorISO: string;
  filter: "all" | "mine" | "week";
  ownerId: string | null;
  users: UserOption[];
}

export function CalendarToolbar({ view, anchorISO, filter, ownerId, users }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [showNew, setShowNew] = useState(false);

  const anchor = new Date(anchorISO);

  function push(next: { view?: CalendarView; anchor?: Date; filter?: string; ownerId?: string | null }) {
    const sp = new URLSearchParams(params.toString());
    if (next.view) sp.set("view", next.view);
    if (next.anchor) sp.set("date", isoDay(next.anchor));
    if (next.filter !== undefined) {
      if (next.filter) sp.set("filter", next.filter);
      else sp.delete("filter");
    }
    if (next.ownerId !== undefined) {
      if (next.ownerId) sp.set("ownerId", next.ownerId);
      else sp.delete("ownerId");
    }
    router.push(`/events?${sp.toString()}`);
  }

  function prev() {
    if (view === "month") push({ anchor: addMonths(anchor, -1) });
    else if (view === "week") push({ anchor: addDays(anchor, -7) });
    else push({ anchor: addDays(anchor, -1) });
  }

  function next() {
    if (view === "month") push({ anchor: addMonths(anchor, 1) });
    else if (view === "week") push({ anchor: addDays(anchor, 7) });
    else push({ anchor: addDays(anchor, 1) });
  }

  function today() {
    push({ anchor: new Date() });
  }

  return (
    <div style={bar}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={today} style={btnSecondary}>Today</button>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button onClick={prev} style={iconBtn} aria-label="Previous">&larr;</button>
          <button onClick={next} style={iconBtn} aria-label="Next">&rarr;</button>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#080707", margin: 0, marginLeft: 8 }}>
          {formatRangeLabel(view, anchor)}
        </h2>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select
          value={filter}
          onChange={(e) => push({ filter: e.target.value })}
          style={select}
          aria-label="Filter"
        >
          <option value="all">All Events</option>
          <option value="mine">My Events</option>
          <option value="week">This Week</option>
        </select>

        <select
          value={ownerId ?? ""}
          onChange={(e) => push({ ownerId: e.target.value || null })}
          style={select}
          aria-label="Owner"
        >
          <option value="">Any owner</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <div style={toggleGroup}>
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              onClick={() => push({ view: v })}
              style={v === view ? toggleActive : toggleBtn}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <a href="/events?view=list" style={{ ...btnSecondary, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
          List
        </a>

        <button onClick={() => setShowNew(true)} style={btnPrimary}>New Event</button>
      </div>

      <NewEventModal open={showNew} onClose={() => { setShowNew(false); router.refresh(); }} />
    </div>
  );
}

function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const bar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  background: "#fff",
  borderBottom: "1px solid #ecebea",
  flexWrap: "wrap",
  gap: 12,
};
const btnPrimary: React.CSSProperties = {
  background: "#0070d2",
  color: "#fff",
  padding: "6px 14px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  border: 0,
  cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  background: "#fff",
  color: "#0070d2",
  padding: "5px 14px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 500,
  border: "1px solid #d8dde6",
  cursor: "pointer",
};
const iconBtn: React.CSSProperties = {
  background: "#fff",
  color: "#080707",
  width: 28,
  height: 28,
  borderRadius: 4,
  fontSize: 14,
  border: "1px solid #d8dde6",
  cursor: "pointer",
};
const select: React.CSSProperties = {
  border: "1px solid #d8dde6",
  borderRadius: 4,
  padding: "5px 8px",
  fontSize: 13,
  background: "#fff",
  color: "#080707",
};
const toggleGroup: React.CSSProperties = {
  display: "flex",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  overflow: "hidden",
};
const toggleBtn: React.CSSProperties = {
  background: "#fff",
  color: "#0070d2",
  padding: "5px 12px",
  fontSize: 13,
  fontWeight: 500,
  border: 0,
  borderLeft: "1px solid #d8dde6",
  cursor: "pointer",
};
const toggleActive: React.CSSProperties = {
  ...toggleBtn,
  background: "#e6f3ff",
  color: "#0b5394",
  fontWeight: 700,
};
