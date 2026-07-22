"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QuickActionsRow } from "@/components/quick-actions/quick-actions-row";
import { RecordEditModal, type EditField } from "@/components/slds/record-edit-modal";

// SF contact header: [+ Follow] then a joined group [Edit | Delete | Clone | v].
const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  padding: "0 12px",
  height: 32,
  fontSize: 13,
  fontWeight: 600,
  color: "#0176d3",
  cursor: "pointer",
  fontFamily: "inherit",
  lineHeight: "26px",
};

const groupBtn: React.CSSProperties = { ...btn, border: 0, borderRadius: 0 };

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "8px 12px",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  fontSize: 13,
  color: "#181818",
};

export function ContactHeaderButtons({
  contactId,
  contactName,
  defaultEmail,
  defaultPhone,
  editFields = [],
  clonePayload,
}: {
  contactId: string;
  contactName?: string;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
  editFields?: EditField[];
  clonePayload?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [moreMenu, setMoreMenu] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  async function deleteContact() {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Contact deleted");
        router.push("/contacts");
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error || "Could not delete contact");
      }
    } finally {
      setBusy(null);
    }
  }

  async function cloneContact() {
    if (!clonePayload) return;
    setBusy("clone");
    try {
      const res = await fetch(`/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clonePayload),
      });
      if (res.ok) {
        const j = (await res.json()) as { id: string };
        toast.success("Contact cloned");
        router.push(`/contacts/${j.id}`);
      } else {
        toast.error("Could not clone contact");
      }
    } finally {
      setBusy(null);
    }
  }

  async function newTask() {
    setBusy("task");
    try {
      const res = await fetch(`/api/contacts/${contactId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: "Follow up", type: "TASK" }),
      });
      if (res.ok) {
        toast.success("Task created");
        router.refresh();
      } else {
        toast.error("Could not create task");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <QuickActionsRow contactId={contactId} defaultEmail={defaultEmail} defaultPhone={defaultPhone} />
      <button
        onClick={() => toast.success("Following contact")}
        disabled={busy !== null}
        style={btn}
      >
        + Follow
      </button>
      <div style={{ display: "inline-flex", border: "1px solid #c9c9c9", borderRadius: 4, overflow: "visible", position: "relative" }}>
        <button style={groupBtn} onClick={() => setEditOpen(true)}>Edit</button>
        <button style={{ ...groupBtn, borderLeft: "1px solid #c9c9c9" }} onClick={() => void deleteContact()} disabled={busy !== null}>
          Delete
        </button>
        <button style={{ ...groupBtn, borderLeft: "1px solid #c9c9c9" }} onClick={() => void cloneContact()} disabled={busy !== null || !clonePayload}>
          Clone
        </button>
        <button
          style={{ ...groupBtn, borderLeft: "1px solid #c9c9c9", padding: "0 10px" }}
          aria-label="More actions"
          onClick={() => setMoreMenu((v) => !v)}
        >
          <svg width="11" height="11" viewBox="0 0 10 10" style={{ fill: "#0176d3" }}>
            <path d="M0 2l5 6 5-6z" />
          </svg>
        </button>
        {moreMenu && (
          <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 30, background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", minWidth: 160, marginTop: 2 }}>
            <button style={menuItemStyle} onClick={() => { setMoreMenu(false); void newTask(); }}>
              New Task
            </button>
            <button style={menuItemStyle} onClick={() => { setMoreMenu(false); toast.info("Use the Activity rail to log a note"); }}>
              New Note
            </button>
          </div>
        )}
      </div>
      <RecordEditModal
        recordTitle={contactName ?? "Contact"}
        endpointBase={`/api/contacts/${contactId}/field`}
        fields={editFields}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
