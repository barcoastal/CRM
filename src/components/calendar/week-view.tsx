import Link from "next/link";
import {
  type CalendarEventRow,
  DAY_HOURS,
  HOUR_HEIGHT,
  formatHour,
  formatTime,
  isSameDay,
  layoutColumns,
  weekDays,
} from "./calendar-helpers";
import { chipColorsForUser, initialFor } from "@/lib/calendar/owner-colors";

interface Props {
  anchorISO: string;
  events: CalendarEventRow[];
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekView({ anchorISO, events }: Props) {
  const anchor = new Date(anchorISO);
  const days = weekDays(anchor);
  const today = new Date();

  return (
    <div style={wrap}>
      <div style={headRow}>
        <div style={gutterHead} />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} style={{
              ...headCell,
              background: isToday ? "#e6f3ff" : "#fafaf9",
              color: isToday ? "#0b5394" : "#747474",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{DOW[d.getDay()]}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div style={body}>
        <div style={gutter}>
          {DAY_HOURS.map((h) => (
            <div key={h} style={hourLabel}>{formatHour(h)}</div>
          ))}
        </div>
        {days.map((d) => (
          <DayColumn key={d.toISOString()} day={d} events={events} isToday={isSameDay(d, today)} />
        ))}
      </div>
    </div>
  );
}

function DayColumn({ day, events, isToday }: { day: Date; events: CalendarEventRow[]; isToday: boolean }) {
  const dayEvents = events.filter((ev) => isSameDay(new Date(ev.startAt), day));
  const placed = layoutColumns(
    dayEvents.map((ev) => {
      const s = new Date(ev.startAt);
      const e = new Date(ev.endAt);
      const startMin = s.getHours() * 60 + s.getMinutes();
      const endMin = Math.max(e.getHours() * 60 + e.getMinutes(), startMin + 30);
      return { ev, startMin, endMin };
    }),
  );

  return (
    <div style={{ ...col, background: isToday ? "#f5fbff" : "#fff" }}>
      {DAY_HOURS.map((h) => (
        <div key={h} style={{
          height: HOUR_HEIGHT,
          borderTop: h === 0 ? 0 : "1px solid #ecebea",
        }} />
      ))}
      {placed.map(({ ev, startMin, endMin, col: colIdx, cols }) => {
        const c = chipColorsForUser(ev.ownerId);
        const top = (startMin / 60) * HOUR_HEIGHT;
        const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT - 2, 18);
        const widthPct = 100 / cols;
        return (
          <Link
            key={ev.id}
            href={`/events/${ev.id}`}
            style={{
              position: "absolute",
              top,
              height,
              left: `calc(${colIdx * widthPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
              background: c.bg,
              color: c.text,
              borderLeft: `3px solid ${c.border}`,
              borderRadius: 3,
              padding: "2px 6px",
              fontSize: 11,
              textDecoration: "none",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
            }}
            title={`${formatTime(new Date(ev.startAt))} ${ev.subject}${ev.ownerName ? ` (${ev.ownerName})` : ""}`}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ ...ownerDot, background: c.dot }}>{initialFor(ev.ownerName)}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ev.subject}</span>
            </div>
            <div style={{ opacity: 0.85 }}>
              {formatTime(new Date(ev.startAt))} – {formatTime(new Date(ev.endAt))}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

const wrap: React.CSSProperties = { background: "#fff", border: "1px solid #ecebea", borderTop: 0 };
const headRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "60px repeat(7, 1fr)",
  borderBottom: "1px solid #ecebea",
};
const gutterHead: React.CSSProperties = { background: "#fafaf9", borderRight: "1px solid #ecebea" };
const headCell: React.CSSProperties = {
  padding: "8px 10px",
  borderRight: "1px solid #ecebea",
  textAlign: "left",
};
const body: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "60px repeat(7, 1fr)",
  position: "relative",
};
const gutter: React.CSSProperties = {
  borderRight: "1px solid #ecebea",
  background: "#fff",
};
const hourLabel: React.CSSProperties = {
  height: HOUR_HEIGHT,
  fontSize: 11,
  color: "#747474",
  textAlign: "right",
  paddingRight: 6,
  paddingTop: 2,
  borderTop: "1px solid #ecebea",
  boxSizing: "border-box",
};
const col: React.CSSProperties = {
  borderRight: "1px solid #ecebea",
  position: "relative",
};
const ownerDot: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 14,
  height: 14,
  borderRadius: "50%",
  color: "#fff",
  fontSize: 9,
  fontWeight: 700,
  flexShrink: 0,
};
