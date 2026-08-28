"use client";

import { useState } from "react";
import type { NodeKind } from "@/lib/flow/nodes";

const OPTIONS: { kind: NodeKind; label: string }[] = [
  { kind: "send_email", label: "Send Email" },
  { kind: "send_sms", label: "Send SMS" },
  { kind: "wait", label: "Wait" },
  { kind: "update_record", label: "Update Record" },
  { kind: "create_task", label: "Create Task" },
  { kind: "decision", label: "Conditional Split" },
];

export function AddStepMenu({ onPick }: { onPick: (kind: NodeKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ec-fb-add">
      <button className="ec-fb-add-btn" onClick={() => setOpen((o) => !o)} title="Add step">+</button>
      {open ? (
        <div className="ec-fb-add-menu" onMouseLeave={() => setOpen(false)}>
          {OPTIONS.map((o) => (
            <button key={o.kind} className="ec-fb-add-item" onClick={() => { onPick(o.kind); setOpen(false); }}>
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
