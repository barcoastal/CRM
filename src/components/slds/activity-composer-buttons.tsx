"use client";

import { useState } from "react";
import { NewTaskModal } from "@/components/quick-actions/new-task-modal";
import { NewEventModal } from "@/components/quick-actions/new-event-modal";
import { useDockedComposer } from "@/components/emails/docked-composer-context";

type Props = {
  leadId?: string;
  opportunityId?: string;
  accountId?: string;
  contactId?: string;
  defaultEmail?: string | null;
};

/**
 * SF Lightning Activity composer button row — three split-button cells with
 * an icon on the left half and a caret-dropdown on the right. Verified
 * against the SF Lead Activity rail screenshot Bar shared 2026-06-07.
 *
 * Email (gray)   | ▼
 * Task  (green)  | ▼
 * Event (purple) | ▼
 */
export function ActivityComposerButtons({ leadId, opportunityId, accountId, contactId, defaultEmail }: Props) {
  const [task, setTask] = useState(false);
  const [event, setEvent] = useState(false);
  const docked = useDockedComposer();

  function openEmail() {
    docked.openComposer({
      to: defaultEmail ?? "",
      subject: "",
      bodyHtml: "",
      leadId, opportunityId, accountId, contactId,
    });
  }

  return (
    <div style={{ display: "flex", gap: 8, padding: "8px 12px", borderBottom: "1px solid #ecebea" }}>
      <SplitButton
        active={false}
        icon={<EnvelopeIcon />}
        bg="#e5e5e5"
        onClick={openEmail}
        onDropdownClick={openEmail}
        ariaLabel="Email"
      />
      <SplitButton
        active
        icon={<TaskIcon />}
        bg="#04844b"
        onClick={() => setTask(true)}
        onDropdownClick={() => setTask(true)}
        ariaLabel="New Task"
      />
      <SplitButton
        active={false}
        icon={<CalendarIcon />}
        bg="#a094ed"
        onClick={() => setEvent(true)}
        onDropdownClick={() => setEvent(true)}
        ariaLabel="New Event"
      />

      <NewTaskModal open={task} onClose={() => setTask(false)} leadId={leadId} opportunityId={opportunityId} accountId={accountId} contactId={contactId} />
      <NewEventModal open={event} onClose={() => setEvent(false)} leadId={leadId} opportunityId={opportunityId} accountId={accountId} contactId={contactId} />
    </div>
  );
}

function SplitButton({
  active, icon, bg, onClick, onDropdownClick, ariaLabel,
}: {
  active: boolean;
  icon: React.ReactNode;
  bg: string;
  onClick: () => void;
  onDropdownClick: () => void;
  ariaLabel: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        border: active ? "2px solid #0176d3" : "1px solid #c9c9c9",
        borderRadius: 4,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      <button
        aria-label={ariaLabel}
        onClick={onClick}
        style={{
          background: bg,
          border: 0,
          padding: "6px 10px",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </button>
      <button
        aria-label={`${ariaLabel} options`}
        onClick={onDropdownClick}
        style={{
          background: "#fff",
          border: 0,
          borderLeft: "1px solid #c9c9c9",
          padding: "0 6px",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: "#747474" }}>
          <path d="M5 7L0 2h10z" />
        </svg>
      </button>
    </div>
  );
}

function EnvelopeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ fill: "#747474" }}>
      <path d="M2 4h20v16H2zm10 9L4 6v12h16V6z" />
    </svg>
  );
}
function TaskIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ fill: "#fff" }}>
      <path d="M4 4h16v16H4zm2 4l3 3 5-5-1.4-1.4L9 8.2 7.4 6.6z" />
      <rect x="10" y="14" width="8" height="2" fill="#fff" />
      <rect x="10" y="10" width="8" height="2" fill="#fff" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ fill: "#fff" }}>
      <path d="M3 6h18v15H3zm3-3h2v3H6zm10 0h2v3h-2zM3 9h18v2H3z" />
    </svg>
  );
}
