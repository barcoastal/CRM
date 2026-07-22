"use client";

import { useState, useRef, useEffect } from "react";
import { NewTaskModal } from "./new-task-modal";
import { NewEventModal } from "./new-event-modal";
import { LogCallModal } from "./log-call-modal";

type Props = {
  leadId?: string;
  opportunityId?: string;
  accountId?: string;
  contactId?: string;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
};

/**
 * SF Lightning header overflow caret (▼) — wraps Quick Actions that don't
 * fit on the visible button row. SF shows only 3 primary actions in the
 * header bar and tucks the rest behind this caret. The dropdown menu opens
 * below the caret button and includes:
 *   New Task | New Event | Log a Call | Send Email | Add to Engagement
 *   Studio List | Send Account Engagement Email
 */
export function QuickActionsRow({ leadId, opportunityId, accountId, contactId, defaultEmail, defaultPhone }: Props) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState(false);
  const [event, setEvent] = useState(false);
  const [call, setCall] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const item = (label: string, onClick: () => void) => (
    <button key={label} onClick={onClick} style={menuItem}>{label}</button>
  );

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        aria-label="Show more actions"
        onClick={() => setOpen((o) => !o)}
        style={caretBtn}
      >
        {/* SF shows the hierarchy glyph on this button. */}
        <svg width="14" height="14" style={{ fill: "#0176d3" }} aria-hidden="true">
          <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#hierarchy" />
        </svg>
      </button>

      {open && (
        <div style={menu}>
          {item("New Task", () => { setTask(true); setOpen(false); })}
          {item("New Event", () => { setEvent(true); setOpen(false); })}
          {item("Log a Call", () => { setCall(true); setOpen(false); })}
          {item("Send Email", () => {
            const mailto = defaultEmail ? `mailto:${defaultEmail}` : "mailto:";
            window.location.href = mailto;
            setOpen(false);
          })}
          {item("Add to Engagement Studio List", () => { setOpen(false); })}
          {item("Send Account Engagement Email", () => { setOpen(false); })}
        </div>
      )}

      <NewTaskModal open={task} onClose={() => setTask(false)} leadId={leadId} opportunityId={opportunityId} accountId={accountId} contactId={contactId} />
      <NewEventModal open={event} onClose={() => setEvent(false)} leadId={leadId} opportunityId={opportunityId} accountId={accountId} contactId={contactId} />
      <LogCallModal open={call} onClose={() => setCall(false)} leadId={leadId} defaultPhone={defaultPhone ?? null} />
    </div>
  );
}

const caretBtn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  height: 32,
  width: 32,
  padding: 0,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const menu: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  right: 0,
  minWidth: 240,
  background: "#fff",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
  zIndex: 100,
  padding: "4px 0",
};

const menuItem: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: 0,
  padding: "8px 16px",
  fontSize: 13,
  color: "#0176d3",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
