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

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #d8dde6",
        borderRadius: 4,
      }}
    >
      {/* Sub-tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #d8dde6",
          padding: "0 12px",
          gap: 0,
        }}
      >
        {(["Email", "New Task", "New Event"] as const).map((t) => {
          const active = composer === t;
          return (
            <button
              key={t}
              onClick={() => setComposer(t)}
              style={{
                background: "transparent",
                border: 0,
                padding: "10px 12px",
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                color: active ? "#16325c" : "#3e3e3c",
                borderBottom: active ? "3px solid #1589ee" : "3px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Composer placeholder */}
      <div
        style={{
          padding: 12,
          fontSize: 12,
          color: "#706e6b",
          borderBottom: "1px solid #f3f3f3",
        }}
      >
        Click here to log a new {composer.toLowerCase().replace("new ", "")}
      </div>

      {/* Filter row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid #f3f3f3",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, color: "#706e6b" }}>
          Filters: Within 3 months · All activities · All types
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#1589ee", cursor: "pointer" }}>
          Refresh · Expand All · View All
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
