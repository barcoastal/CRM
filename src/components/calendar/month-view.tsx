import Link from "next/link";
import {
  type CalendarEventRow,
  chipColors,
  isSameDay,
  isSameMonth,
  monthGridDays,
} from "./calendar-helpers";

interface Props {
  anchorISO: string;
  events: CalendarEventRow[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthView({ anchorISO, events }: Props) {
  const anchor = new Date(anchorISO);
  const days = monthGridDays(anchor);
  const today = new Date();

  // Bucket events by yyyy-mm-dd for the cell they start in.
  const buckets = new Map<string, CalendarEventRow[]>();
  for (const ev of events) {
    const k = ymd(new Date(ev.startAt));
    const arr = buckets.get(k) ?? [];
    arr.push(ev);
    buckets.set(k, arr);
  }

  return (
    <div style={wrap}>
      <div style={headRow}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={headCell}>{w}</div>
        ))}
      </div>
      <div style={gridStyle}>
        {days.map((d) => {
          const key = ymd(d);
          const dayEvents = (buckets.get(key) ?? []).sort(
            (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
          );
          const inMonth = isSameMonth(d, anchor);
          const isToday = isSameDay(d, today);
          return (
            <div key={key} style={{
              ...cell,
              background: isToday ? "#e6f3ff" : "#fff",
              opacity: inMonth ? 1 : 0.55,
            }}>
              <div style={{
                ...dateNum,
                color: isToday ? "#0b5394" : (inMonth ? "#080707" : "#706e6b"),
                fontWeight: isToday ? 700 : 500,
              }}>
                {d.getDate()}
              </div>
              <div style={chipStack}>
                {dayEvents.slice(0, 3).map((ev) => {
                  const c = chipColors(ev.related.kind);
                  const time = new Date(ev.startAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                  return (
                    <Link
                      key={ev.id}
                      href={`/events/${ev.id}`}
                      style={{
                        ...chip,
                        background: c.bg,
                        color: c.text,
                        borderLeft: `3px solid ${c.border}`,
                      }}
                      title={`${time} ${ev.subject}`}
                    >
                      <span style={{ fontWeight: 600 }}>{time}</span> {ev.subject}
                    </Link>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div style={moreNote}>+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const wrap: React.CSSProperties = { background: "#fff", border: "1px solid #ecebea", borderTop: 0 };
const headRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  background: "#fafaf9",
  borderBottom: "1px solid #ecebea",
};
const headCell: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 700,
  color: "#706e6b",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  textAlign: "left",
  borderRight: "1px solid #ecebea",
};
const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gridAutoRows: "minmax(110px, 1fr)",
};
const cell: React.CSSProperties = {
  borderRight: "1px solid #ecebea",
  borderBottom: "1px solid #ecebea",
  padding: 4,
  display: "flex",
  flexDirection: "column",
  gap: 3,
  minHeight: 110,
  overflow: "hidden",
};
const dateNum: React.CSSProperties = {
  fontSize: 13,
  padding: "2px 6px",
  alignSelf: "flex-start",
};
const chipStack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const chip: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  padding: "2px 6px",
  borderRadius: 3,
  textDecoration: "none",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const moreNote: React.CSSProperties = { fontSize: 11, color: "#706e6b", padding: "0 6px" };
