"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { chipColorsForUser, initialFor } from "@/lib/calendar/owner-colors";

interface Props {
  users: Array<{ id: string; name: string }>;
  ownerIds: string[];
  eventCount: number;
  uniqueOwnerCount: number;
}

/**
 * Legend strip that sits between the toolbar and the calendar grid.
 *
 * Renders one removable pill per selected user (colored dot + name + X)
 * and the "N events from M users" subtitle.
 */
export function CalendarLegend({ users, ownerIds, eventCount, uniqueOwnerCount }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  if (users.length === 0) return null;

  function removeOwner(id: string) {
    const remaining = ownerIds.filter((x) => x !== id);
    const sp = new URLSearchParams(params.toString());
    sp.delete("ownerId");
    sp.delete("filter");
    if (remaining.length === 0) {
      sp.delete("ownerIds");
    } else {
      sp.set("ownerIds", remaining.join(","));
    }
    router.push(`/events?${sp.toString()}`);
  }

  return (
    <div style={wrap}>
      <div style={pillRow}>
        {users.map((u) => {
          const c = chipColorsForUser(u.id);
          return (
            <span key={u.id} style={{ ...pill, background: c.bg, color: c.text, borderColor: c.border }}>
              <span style={{ ...dot, background: c.dot }}>{initialFor(u.name)}</span>
              <span style={{ marginLeft: 6 }}>{u.name}</span>
              <button
                onClick={() => removeOwner(u.id)}
                style={removeBtn}
                aria-label={`Remove ${u.name}`}
                title={`Remove ${u.name}`}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      <div style={subtitle}>
        Showing {eventCount} event{eventCount === 1 ? "" : "s"} from {uniqueOwnerCount} user
        {uniqueOwnerCount === 1 ? "" : "s"}.
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "8px 16px",
  background: "#fff",
  borderBottom: "1px solid #ecebea",
  flexWrap: "wrap",
};
const pillRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};
const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px 2px 4px",
  borderRadius: 999,
  border: "1px solid",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.4,
};
const dot: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  height: 18,
  borderRadius: "50%",
  color: "#fff",
  fontSize: 10,
  fontWeight: 700,
};
const removeBtn: React.CSSProperties = {
  marginLeft: 6,
  background: "transparent",
  border: 0,
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  color: "inherit",
  opacity: 0.7,
  padding: 0,
};
const subtitle: React.CSSProperties = {
  fontSize: 12,
  color: "#706e6b",
};
