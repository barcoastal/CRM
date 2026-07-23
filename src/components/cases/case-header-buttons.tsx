"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RecordEditModal, type EditField } from "@/components/slds/record-edit-modal";

// SF case header: [+ Follow] then a joined group [Edit | Delete | Change Owner | v].
const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  padding: "0 12px",
  height: 32,
  fontSize: 13,
  fontWeight: 400,
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

export function CaseHeaderButtons({
  caseId,
  caseNumber,
  currentOwner,
  editFields = [],
}: {
  caseId: string;
  caseNumber: string;
  currentOwner?: string | null;
  editFields?: EditField[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [moreMenu, setMoreMenu] = useState(false);
  const [ownerModal, setOwnerModal] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [pickedOwner, setPickedOwner] = useState("");

  useEffect(() => {
    if (!ownerModal || users.length > 0) return;
    fetch("/api/users?limit=200")
      .then((r) => r.json())
      .then((j: { users?: { id: string; name: string }[] } | { id: string; name: string }[]) => {
        const list = Array.isArray(j) ? j : (j.users ?? []);
        setUsers(list.map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => toast.error("Could not load users"));
  }, [ownerModal, users.length]);

  async function deleteCase() {
    if (!confirm(`Delete case ${caseNumber}?`)) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Case deleted");
        router.push("/cases");
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error || "Could not delete case");
      }
    } finally {
      setBusy(null);
    }
  }

  async function changeOwner() {
    if (!pickedOwner) return;
    setBusy("owner");
    try {
      const res = await fetch(`/api/cases/${caseId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: pickedOwner }),
      });
      if (res.ok) {
        toast.success("Owner changed");
        setOwnerModal(false);
        router.refresh();
      } else {
        toast.error("Could not change owner");
      }
    } finally {
      setBusy(null);
    }
  }

  async function act(path: string, label: string) {
    setBusy(path);
    try {
      const res = await fetch(`/api/cases/${caseId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast.success(label);
        router.refresh();
      } else {
        toast.error(`Could not ${label.toLowerCase()}`);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <button onClick={() => toast.success("Following case")} style={btn}>+ Follow</button>
      <div style={{ display: "inline-flex", border: "1px solid #c9c9c9", borderRadius: 4, position: "relative" }}>
        <button style={groupBtn} onClick={() => setEditOpen(true)}>Edit</button>
        <button style={{ ...groupBtn, borderLeft: "1px solid #c9c9c9" }} onClick={() => void deleteCase()} disabled={busy !== null}>
          Delete
        </button>
        <button style={{ ...groupBtn, borderLeft: "1px solid #c9c9c9" }} onClick={() => setOwnerModal(true)}>
          Change Owner
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
            <button style={menuItemStyle} onClick={() => { setMoreMenu(false); void act("escalate", "Case escalated"); }}>
              Escalate
            </button>
            <button style={menuItemStyle} onClick={() => { setMoreMenu(false); void act("close", "Case closed"); }}>
              Close Case
            </button>
          </div>
        )}
      </div>

      <RecordEditModal
        recordTitle={caseNumber}
        endpointBase={`/api/cases/${caseId}`}
        fields={editFields}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />

      {ownerModal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(8,7,7,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "120px 16px" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOwnerModal(false); }}
        >
          <div style={{ background: "#fff", borderRadius: 8, width: "min(480px, 100%)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
            <header style={{ padding: "16px 24px 12px", borderBottom: "1px solid #e5e5e5" }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 400, color: "#181818", textAlign: "center" }}>Change Case Owner</h2>
            </header>
            <div style={{ padding: "16px 24px" }}>
              {currentOwner && (
                <div style={{ fontSize: 12, color: "#444444", marginBottom: 8 }}>Current owner: {currentOwner}</div>
              )}
              <label style={{ display: "block", fontSize: 12, color: "#444444", marginBottom: 3 }}>New Owner</label>
              <select
                value={pickedOwner}
                onChange={(e) => setPickedOwner(e.target.value)}
                style={{ width: "100%", height: 32, border: "1px solid #c9c9c9", borderRadius: 4, padding: "0 8px", fontSize: 13 }}
              >
                <option value="">--Select a user--</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <footer style={{ borderTop: "1px solid #e5e5e5", padding: "12px 24px", display: "flex", justifyContent: "center", gap: 8, background: "#f3f3f3", borderRadius: "0 0 8px 8px" }}>
              <button onClick={() => setOwnerModal(false)} style={btn}>Cancel</button>
              <button
                onClick={() => void changeOwner()}
                disabled={!pickedOwner || busy === "owner"}
                style={{ ...btn, background: "#0176d3", border: "1px solid #0176d3", color: "#fff" }}
              >
                {busy === "owner" ? "Saving…" : "Change Owner"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
