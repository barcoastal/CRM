"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DispositionModal } from "./disposition-modal";
import type { LeadStatusV2 } from "@/lib/sf-canonical";

const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #d8dde6",
  color: "#0070d2",
  padding: "4px 12px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export function LeadHeaderButtons({
  leadId,
  currentStage,
}: {
  leadId: string;
  currentStage: LeadStatusV2;
}) {
  const router = useRouter();
  const [modal, setModal] = useState(false);

  async function quickCreate(kind: "Task" | "Event") {
    const res = await fetch(`/api/${kind === "Task" ? "tasks" : "events"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        kind === "Task"
          ? { leadId, subject: "New Task", type: "TASK", status: "NOT_STARTED" }
          : {
              leadId,
              subject: "New Event",
              startAt: new Date().toISOString(),
              endAt: new Date(Date.now() + 3600_000).toISOString(),
            }
      ),
    });
    if (res.ok) router.refresh();
  }

  return (
    <>
      <button style={btn} onClick={() => setModal(true)}>
        Disposition
      </button>
      <button style={btn} onClick={() => quickCreate("Task")}>
        New Task
      </button>
      <button style={btn} onClick={() => quickCreate("Event")}>
        New Event
      </button>
      <DispositionModal
        leadId={leadId}
        currentStage={currentStage}
        open={modal}
        onClose={() => setModal(false)}
      />
    </>
  );
}
