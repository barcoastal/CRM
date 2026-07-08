import Link from "next/link";
import {
  type CalendarEventRow,
  DAY_HOURS,
  HOUR_HEIGHT,
  formatHour,
  formatTime,
  isSameDay,
  layoutColumns,
} from "./calendar-helpers";
import { chipColorsForUser, initialFor } from "@/lib/calendar/owner-colors";

interface Props {
  anchorISO: string;
  events: CalendarEventRow[];
}

export function DayView({ anchorISO, events }: Props) {
  const day = new Date(anchorISO);
  const today = new Date();
  const isToday = isSameDay(day, today);

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
    <div style={wrap}>
      <div style={{
        ...headBar,
        background: isToday ? "#e6f3ff" : "#fafaf9",
        color: isToday ? "#0b5394" : "#181818",
      }}>
        {day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        {isToday && <span style={todayBadge}>Today</span>}
      </div>
      <div style={body}>
        <div style={gutter}>
          {DAY_HOURS.map((h) => (
            <div key={h} style={hourLabel}>{formatHour(h)}</div>
          ))}
        </div>
        <div style={col}>
          {DAY_HOURS.map((h) => (
            <div key={h} style={{
              height: HOUR_HEIGHT,
              borderTop: h === 0 ? 0 : "1px solid #ecebea",
            }} />
          ))}
          {placed.map(({ ev, startMin, endMin, col: colIdx, cols }) => {
            const c = chipColorsForUser(ev.ownerId);
            const top = (startMin / 60) * HOUR_HEIGHT;
            const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT - 2, 22);
            const widthPct = 100 / cols;
            return (
              <Link
                key={ev.id}
                href={`/events/${ev.id}`}
                style={{
                  position: "absolute",
                  top,
                  height,
                  left: `calc(${colIdx * widthPct}% + 4px)`,
                  width: `calc(${widthPct}% - 8px)`,
                  background: c.bg,
                  color: c.text,
                  borderLeft: `4px solid ${c.border}`,
                  borderRadius: 4,
                  padding: "4px 8px",
                  fontSize: 12,
                  textDecoration: "none",
                  overflow: "hidden",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}
                title={`${formatTime(new Date(ev.startAt))} ${ev.subject}${ev.ownerName ? ` (${ev.ownerName})` : ""}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ ...ownerDot, background: c.dot }}>{initialFor(ev.ownerName)}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ev.subject}</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>
                  {formatTime(new Date(ev.startAt))} – {formatTime(new Date(ev.endAt))}
                </div>
                {ev.ownerName && <div style={{ fontSize: 11, opacity: 0.75 }}>{ev.ownerName}</div>}
                {ev.location && <div style={{ fontSize: 11, opacity: 0.75 }}>{ev.location}</div>}
                {ev.related.label && <div style={{ fontSize: 11, opacity: 0.85 }}>{ev.related.label}</div>}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { background: "#fff", border: "1px solid #ecebea", borderTop: 0 };
const headBar: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 700,
  borderBottom: "1px solid #ecebea",
  display: "flex",
  alignItems: "center",
  gap: 10,
};
const todayBadge: React.CSSProperties = {
  background: "#0b5394",
  color: "#fff",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  padding: "2px 6px",
  borderRadius: 3,
};
const body: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px 1fr",
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
  paddingRight: 8,
  paddingTop: 2,
  borderTop: "1px solid #ecebea",
  boxSizing: "border-box",
};
const col: React.CSSProperties = {
  position: "relative",
  background: "#fff",
};
const ownerDot: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 16,
  height: 16,
  borderRadius: "50%",
  color: "#fff",
  fontSize: 10,
  fontWeight: 700,
  flexShrink: 0,
};
