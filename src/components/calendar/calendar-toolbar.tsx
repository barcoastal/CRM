"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { NewEventModal } from "@/components/quick-actions/new-event-modal";
import {
  type CalendarView,
  addDays,
  addMonths,
  formatRangeLabel,
} from "./calendar-helpers";
import { chipColorsForUser, initialFor } from "@/lib/calendar/owner-colors";

type UserOption = { id: string; name: string };

type Preset = "mine" | "team" | "all" | "custom" | "none";

interface Props {
  view: CalendarView;
  anchorISO: string;
  ownerIds: string[];
  preset: Preset;
  users: UserOption[];
  sessionUserId: string | null;
  maxUsers: number;
}

export function CalendarToolbar({
  view,
  anchorISO,
  ownerIds,
  preset,
  users,
  sessionUserId,
  maxUsers,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [showNew, setShowNew] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const anchor = new Date(anchorISO);

  const usersById = useMemo(() => {
    const m = new Map<string, UserOption>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  // Close picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  function pushOwnerIds(nextValue: string | null, extra?: { view?: CalendarView; anchor?: Date }) {
    const sp = new URLSearchParams(params.toString());
    // Drop legacy params so they don't fight the new one.
    sp.delete("ownerId");
    sp.delete("filter");
    if (nextValue === null) {
      sp.delete("ownerIds");
    } else {
      sp.set("ownerIds", nextValue);
    }
    if (extra?.view) sp.set("view", extra.view);
    if (extra?.anchor) sp.set("date", isoDay(extra.anchor));
    router.push(`/events?${sp.toString()}`);
  }

  function pushView(next: { view?: CalendarView; anchor?: Date }) {
    const sp = new URLSearchParams(params.toString());
    if (next.view) sp.set("view", next.view);
    if (next.anchor) sp.set("date", isoDay(next.anchor));
    router.push(`/events?${sp.toString()}`);
  }

  function prev() {
    if (view === "month") pushView({ anchor: addMonths(anchor, -1) });
    else if (view === "week") pushView({ anchor: addDays(anchor, -7) });
    else pushView({ anchor: addDays(anchor, -1) });
  }

  function next() {
    if (view === "month") pushView({ anchor: addMonths(anchor, 1) });
    else if (view === "week") pushView({ anchor: addDays(anchor, 7) });
    else pushView({ anchor: addDays(anchor, 1) });
  }

  function today() {
    pushView({ anchor: new Date() });
  }

  function selectMine() {
    pushOwnerIds("mine");
    setPickerOpen(false);
  }

  function selectTeam() {
    // Server resolves "team" -> self + reports.
    pushOwnerIds("team");
    setPickerOpen(false);
  }

  function selectEveryone() {
    if (users.length > maxUsers) {
      const ok = window.confirm(
        `There are ${users.length} active users. Only the first ${maxUsers} will be shown to keep the calendar fast. Continue?`,
      );
      if (!ok) return;
    }
    pushOwnerIds("all");
    setPickerOpen(false);
  }

  function toggleUser(id: string) {
    const current = new Set(ownerIds);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    const ids = Array.from(current);
    if (ids.length === 0) pushOwnerIds(null);
    else pushOwnerIds(ids.join(","));
  }

  const filteredUsers = users.filter((u) =>
    pickerQuery.trim() === "" ? true : u.name.toLowerCase().includes(pickerQuery.toLowerCase()),
  );

  const labelForPicker = (() => {
    if (preset === "mine") return "Just mine";
    if (preset === "team") return "My team";
    if (preset === "all") return "Everyone";
    if (preset === "none") return "Nobody";
    if (ownerIds.length === 1) {
      return usersById.get(ownerIds[0])?.name ?? "1 user";
    }
    return `${ownerIds.length} users`;
  })();

  return (
    <div style={bar}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={today} style={btnSecondary}>Today</button>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button onClick={prev} style={iconBtn} aria-label="Previous">&larr;</button>
          <button onClick={next} style={iconBtn} aria-label="Next">&rarr;</button>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#181818", margin: 0, marginLeft: 8 }}>
          {formatRangeLabel(view, anchor)}
        </h2>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={presetGroup}>
          <button
            onClick={selectMine}
            style={preset === "mine" ? presetActive : presetBtn}
            disabled={!sessionUserId}
            title="Show only my events"
          >
            Just mine
          </button>
          <button
            onClick={selectTeam}
            style={preset === "team" ? presetActive : presetBtn}
            disabled={!sessionUserId}
            title="Show my events plus my direct reports"
          >
            My team
          </button>
          <button
            onClick={selectEveryone}
            style={preset === "all" ? presetActive : presetBtn}
            title={`Show all active users (capped at ${maxUsers})`}
          >
            Everyone
          </button>
        </div>

        <div ref={pickerRef} style={{ position: "relative" }}>
          <button
            onClick={() => setPickerOpen((o) => !o)}
            style={pickerToggle}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
          >
            <span>{labelForPicker}</span>
            <span style={{ opacity: 0.6, marginLeft: 6 }}>{pickerOpen ? "▲" : "▼"}</span>
          </button>
          {pickerOpen && (
            <div style={pickerPanel} role="listbox">
              <input
                autoFocus
                type="text"
                placeholder="Search users..."
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                style={pickerSearch}
              />
              <div style={pickerBody}>
                {filteredUsers.length === 0 && (
                  <div style={{ padding: "8px 12px", fontSize: 12, color: "#747474" }}>
                    No users match.
                  </div>
                )}
                {filteredUsers.map((u) => {
                  const checked = ownerIds.includes(u.id);
                  const c = chipColorsForUser(u.id);
                  return (
                    <label key={u.id} style={pickerRow}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(u.id)}
                        style={{ marginRight: 8 }}
                      />
                      <span style={{ ...dot, background: c.dot }}>{initialFor(u.name)}</span>
                      <span style={{ flex: 1, color: "#181818" }}>{u.name}</span>
                    </label>
                  );
                })}
              </div>
              <div style={pickerFooter}>
                <button onClick={() => pushOwnerIds(null)} style={btnSecondary}>
                  Clear
                </button>
                <button onClick={() => setPickerOpen(false)} style={btnPrimary}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={toggleGroup}>
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              onClick={() => pushView({ view: v })}
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
  background: "#0176d3",
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
  color: "#0176d3",
  padding: "5px 14px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 500,
  border: "1px solid #c9c9c9",
  cursor: "pointer",
};
const iconBtn: React.CSSProperties = {
  background: "#fff",
  color: "#181818",
  width: 28,
  height: 28,
  borderRadius: 4,
  fontSize: 14,
  border: "1px solid #c9c9c9",
  cursor: "pointer",
};
const toggleGroup: React.CSSProperties = {
  display: "flex",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  overflow: "hidden",
};
const toggleBtn: React.CSSProperties = {
  background: "#fff",
  color: "#0176d3",
  padding: "5px 12px",
  fontSize: 13,
  fontWeight: 500,
  border: 0,
  borderLeft: "1px solid #c9c9c9",
  cursor: "pointer",
};
const toggleActive: React.CSSProperties = {
  ...toggleBtn,
  background: "#e6f3ff",
  color: "#0b5394",
  fontWeight: 700,
};
const presetGroup: React.CSSProperties = {
  display: "flex",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  overflow: "hidden",
};
const presetBtn: React.CSSProperties = {
  background: "#fff",
  color: "#0176d3",
  padding: "5px 12px",
  fontSize: 13,
  fontWeight: 500,
  border: 0,
  borderLeft: "1px solid #c9c9c9",
  cursor: "pointer",
};
const presetActive: React.CSSProperties = {
  ...presetBtn,
  background: "#e6f3ff",
  color: "#0b5394",
  fontWeight: 700,
};
const pickerToggle: React.CSSProperties = {
  background: "#fff",
  color: "#181818",
  padding: "5px 12px",
  fontSize: 13,
  fontWeight: 500,
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  minWidth: 140,
  justifyContent: "space-between",
};
const pickerPanel: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  right: 0,
  background: "#fff",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
  minWidth: 280,
  zIndex: 50,
  display: "flex",
  flexDirection: "column",
};
const pickerSearch: React.CSSProperties = {
  border: 0,
  borderBottom: "1px solid #ecebea",
  padding: "8px 12px",
  fontSize: 13,
  outline: "none",
  background: "#fff",
  color: "#181818",
};
const pickerBody: React.CSSProperties = {
  maxHeight: 280,
  overflowY: "auto",
};
const pickerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "6px 12px",
  fontSize: 13,
  cursor: "pointer",
  borderBottom: "1px solid #f3f3f2",
};
const pickerFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: 8,
  borderTop: "1px solid #ecebea",
  background: "#fafaf9",
};
const dot: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 20,
  borderRadius: "50%",
  marginRight: 8,
  color: "#fff",
  fontSize: 10,
  fontWeight: 700,
  flexShrink: 0,
};
