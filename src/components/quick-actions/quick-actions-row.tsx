"use client";

import { useState } from "react";
import { NewTaskModal } from "./new-task-modal";
import { NewEventModal } from "./new-event-modal";
import { LogCallModal } from "./log-call-modal";
import { ComposeEmailButton } from "@/components/emails/compose-email-button";

type Props = {
  leadId?: string;
  opportunityId?: string;
  accountId?: string;
  contactId?: string;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
};

/**
 * SF Lightning Quick Actions strip — New Task, New Event, Log a Call, Email.
 * Lives at the top right of the detail page header next to the existing
 * Disposition/Edit/etc. action buttons.
 */
export function QuickActionsRow({ leadId, opportunityId, accountId, contactId, defaultEmail, defaultPhone }: Props) {
  const [task, setTask] = useState(false);
  const [event, setEvent] = useState(false);
  const [call, setCall] = useState(false);

  return (
    <>
      <button style={btn} onClick={() => setTask(true)}>New Task</button>
      <button style={btn} onClick={() => setEvent(true)}>New Event</button>
      <button style={btn} onClick={() => setCall(true)}>Log a Call</button>
      <ComposeEmailButton
        defaultTo={defaultEmail ?? null}
        leadId={leadId}
        opportunityId={opportunityId}
        accountId={accountId}
        contactId={contactId}
        label="Email"
      />

      <NewTaskModal open={task} onClose={() => setTask(false)} leadId={leadId} opportunityId={opportunityId} accountId={accountId} contactId={contactId} />
      <NewEventModal open={event} onClose={() => setEvent(false)} leadId={leadId} opportunityId={opportunityId} accountId={accountId} contactId={contactId} />
      <LogCallModal open={call} onClose={() => setCall(false)} leadId={leadId} defaultPhone={defaultPhone ?? null} />
    </>
  );
}

const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dde6",
  color: "#0070d2",
  padding: "0 12px",
  height: 32,
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 400,
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
};
