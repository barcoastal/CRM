"use client";

import { useState, type ReactNode } from "react";
import { ObjectIcon } from "./icon";

export interface ActivityItem {
  id: string;
  type: "TASK" | "EVENT" | "CALL" | "EMAIL" | "SMS";
  subject: string;
  meta?: ReactNode;
  date: Date;
  done?: boolean;
}

const ENTITY_BY_TYPE: Record<ActivityItem["type"], string> = {
  TASK: "Task",
  EVENT: "Event",
  CALL: "Dialer",
  EMAIL: "Email",
  SMS: "Sms",
};

/**
 * Right-rail Activity card from SF record pages. Top section has composer
 * sub-tabs (Email, New Task, New Event), filter info, then a chronological
 * timeline of activities grouped by month.
 */
export function ActivityRail({ items }: { items: readonly ActivityItem[] }) {
  const [composer, setComposer] = useState<"Email" | "New Task" | "New Event">("Email");

  // Split by upcoming vs past, then group past by month
  const now = new Date();
  const upcoming = items.filter((i) => i.date >= now).sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = items.filter((i) => i.date < now).sort((a, b) => b.date.getTime() - a.date.getTime());

  const pastByMonth = new Map<string, ActivityItem[]>();
  for (const item of past) {
    const key = item.date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const arr = pastByMonth.get(key) ?? [];
    arr.push(item);
    pastByMonth.set(key, arr);
  }

  // SF Lightning composer icons: Email, Log a Call, New Task, New Event
  const COMPOSERS: { key: "Email" | "New Task" | "New Event"; label: string; icon: string }[] = [
    { key: "Email", label: "Email", icon: "M2 4l8 5 8-5v10H2z M2 4l8 5 8-5" },
    { key: "New Task", label: "New Task", icon: "M3 3h14v14H3z M7 9l3 3 5-5" },
    { key: "New Event", label: "New Event", icon: "M4 5h12v11H4z M4 8h12 M7 3v3 M13 3v3" },
  ];

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #dddbda",
        borderRadius: 4,
      }}
    >
      {/* Composer icon strip — SF Lightning style */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 12px",
          borderBottom: "1px solid #dddbda",
          gap: 4,
          background: "#fff",
        }}
      >
        {COMPOSERS.map((c) => {
          const active = composer === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setComposer(c.key)}
              title={c.label}
              style={{
                background: active ? "#eaf5fe" : "transparent",
                border: active ? "1px solid #1589ee" : "1px solid transparent",
                padding: "4px 8px",
                fontSize: 12,
                fontWeight: 400,
                color: active ? "#0176d3" : "#3e3e3c",
                borderRadius: 4,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                lineHeight: 1.2,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={active ? "#0176d3" : "#54698d"} strokeWidth="1.5">
                <path d={c.icon} />
              </svg>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Composer placeholder */}
      <div
        style={{
          padding: "10px 12px",
          fontSize: 12,
          color: "#706e6b",
          borderBottom: "1px solid #ecebea",
        }}
      >
        {composer === "Email"
          ? "Click here to log a new email"
          : composer === "New Task"
          ? "Click here to log a new task"
          : "Click here to log a new event"}
      </div>

      {/* Filter / actions row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 12px",
          borderBottom: "1px solid #ecebea",
          gap: 6,
          background: "#fafaf9",
        }}
      >
        <label style={{ display: "inline-flex", alignItems: "center", fontSize: 11, color: "#3e3e3c", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" style={{ margin: 0 }} />
          Only show activities with insights
        </label>
        <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8, fontSize: 11, color: "#0176d3" }}>
          <button style={{ background: "transparent", border: 0, color: "#0176d3", cursor: "pointer", padding: 0, fontSize: 11 }}>Refresh</button>
          <span style={{ color: "#dddbda" }}>·</span>
          <button style={{ background: "transparent", border: 0, color: "#0176d3", cursor: "pointer", padding: 0, fontSize: 11 }}>Expand All</button>
          <span style={{ color: "#dddbda" }}>·</span>
          <button style={{ background: "transparent", border: 0, color: "#0176d3", cursor: "pointer", padding: 0, fontSize: 11 }}>View All</button>
        </span>
      </div>

      {/* Upcoming & Overdue */}
      <Section title={`Upcoming & Overdue`}>
        {upcoming.length === 0 && (
          <div style={{ padding: 16, color: "#706e6b", fontSize: 12 }}>
            No activities to show. Get started by sending an email, logging a call, or scheduling a task.
          </div>
        )}
        {upcoming.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </Section>

      {/* Past — grouped by month */}
      {Array.from(pastByMonth.entries()).map(([month, list]) => (
        <Section key={month} title={month} sub="Last Month">
          {list.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </Section>
      ))}
    </article>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "#fafaf9",
          border: 0,
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          borderTop: "1px solid #ecebea",
          borderBottom: open ? "1px solid #ecebea" : "none",
        }}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 10 10"
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform .15s",
            fill: "#3e3e3c",
          }}
        >
          <path d="M2 0l6 5-6 5z" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#080707" }}>{title}</span>
        {sub && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#706e6b" }}>{sub}</span>
        )}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const entity = ENTITY_BY_TYPE[item.type];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 10,
        padding: "10px 12px",
        borderBottom: "1px solid #f3f3f3",
        alignItems: "flex-start",
      }}
    >
      <ObjectIcon entity={entity} size="small" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "#080707", fontWeight: 600 }}>{item.subject}</div>
        {item.meta && (
          <div style={{ fontSize: 11, color: "#706e6b", marginTop: 2 }}>{item.meta}</div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#706e6b", whiteSpace: "nowrap" }}>
        {item.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </div>
    </div>
  );
}
