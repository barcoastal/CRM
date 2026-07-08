"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal, ModalButton } from "@/components/slds/modal";
import { useListSelection } from "./list-table-wrapper";

interface UserOption { id: string; name: string; email: string; }

export interface BulkStatusOption { value: string; label: string; }

export interface BulkActionBarProps {
  /** entity slug used in the /api/bulk-edit/<entity> URL */
  entity: string;
  /** field name on the entity that stores the owner FK (e.g. ownerId, assignedToId) */
  ownerField?: string;
  /** field name + options for the Change Status button. Omit to hide it. */
  statusField?: string;
  statusLabel?: string;
  statusOptions?: BulkStatusOption[];
  /** when true, show the Delete button. Defaults to true. */
  allowDelete?: boolean;
}

/**
 * Bulk action bar for ListView-based pages. Sticky strip that appears when
 * one or more rows are selected. Renders Reassign Owner / Change Status /
 * Delete buttons and pops modals for each. Talks to /api/bulk-edit.
 *
 * Visual: brand-blue gradient strip, red border around the Delete button.
 */
export function BulkActionBar({
  entity,
  ownerField,
  statusField,
  statusLabel,
  statusOptions,
  allowDelete = true,
}: BulkActionBarProps) {
  const { selected, clear } = useListSelection();
  const router = useRouter();
  const count = selected.size;
  const ids = useMemo(() => Array.from(selected), [selected]);
  const [modal, setModal] = useState<"owner" | "status" | "delete" | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerVal, setOwnerVal] = useState("");
  const [statusVal, setStatusVal] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (modal !== "owner" || users.length > 0) return;
    void (async () => {
      const res = await fetch("/api/users?limit=200");
      if (res.ok) {
        const data = (await res.json()) as { users?: UserOption[] };
        setUsers(data.users ?? []);
      }
    })();
  }, [modal, users.length]);

  async function patch(body: Record<string, unknown>): Promise<{ ok: boolean; updated?: number; deleted?: number; error?: string }> {
    const res = await fetch(`/api/bulk-edit/${entity}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => ({ ok: false, error: "Network error" }))) as { ok: boolean; updated?: number; deleted?: number; error?: string };
  }

  async function doOwner() {
    if (!ownerField) return;
    if (!ownerVal) { toast.error("Pick a user"); return; }
    setBusy(true);
    try {
      const data = await patch({ ids, patch: { [ownerField]: ownerVal } });
      if (data.ok) {
        toast.success(`Reassigned ${data.updated ?? count} record${(data.updated ?? count) === 1 ? "" : "s"}`);
        setModal(null);
        clear();
        router.refresh();
      } else {
        toast.error(data.error ?? "Update failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function doStatus() {
    if (!statusField) return;
    if (!statusVal) { toast.error("Pick a value"); return; }
    setBusy(true);
    try {
      const data = await patch({ ids, patch: { [statusField]: statusVal } });
      if (data.ok) {
        toast.success(`Updated ${statusLabel?.toLowerCase() ?? "status"} on ${data.updated ?? count} record${(data.updated ?? count) === 1 ? "" : "s"}`);
        setModal(null);
        clear();
        router.refresh();
      } else {
        toast.error(data.error ?? "Update failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      const data = await patch({ ids, delete: true });
      if (data.ok) {
        toast.success(`Deleted ${data.deleted ?? count} record${(data.deleted ?? count) === 1 ? "" : "s"}`);
        setModal(null);
        clear();
        router.refresh();
      } else {
        toast.error(data.error ?? "Delete failed");
      }
    } finally {
      setBusy(false);
    }
  }

  if (count === 0) return null;

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk actions"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "linear-gradient(135deg, #0034e4, #3052ff)",
          color: "#fff",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 13,
          borderRadius: 4,
          marginBottom: 8,
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        <span style={{ fontWeight: 700 }}>{count} selected</span>
        <button
          type="button"
          onClick={clear}
          style={{
            background: "transparent",
            border: "none",
            color: "#cdd6ff",
            cursor: "pointer",
            fontSize: 12,
            textDecoration: "underline",
            padding: 0,
          }}
        >
          Clear
        </button>
        <div style={{ flex: 1 }} />
        {ownerField && (
          <BarBtn onClick={() => { setOwnerVal(""); setModal("owner"); }}>Reassign Owner</BarBtn>
        )}
        {statusField && statusOptions && statusOptions.length > 0 && (
          <BarBtn onClick={() => { setStatusVal(""); setModal("status"); }}>
            Change {statusLabel ?? "Status"}
          </BarBtn>
        )}
        {allowDelete && (
          <BarBtn danger onClick={() => setModal("delete")}>Delete</BarBtn>
        )}
      </div>

      {/* Owner picker */}
      <Modal
        open={modal === "owner"}
        onClose={() => setModal(null)}
        title="Reassign Owner"
        size="small"
        footer={(
          <>
            <ModalButton onClick={() => setModal(null)} disabled={busy}>Cancel</ModalButton>
            <ModalButton variant="brand" onClick={doOwner} disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </ModalButton>
          </>
        )}
      >
        <div style={{ fontSize: 13, color: "#444444", marginBottom: 10 }}>
          Reassign {count} selected record{count === 1 ? "" : "s"}.
        </div>
        <select
          value={ownerVal}
          onChange={(e) => setOwnerVal(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
          ))}
        </select>
      </Modal>

      {/* Status picker */}
      <Modal
        open={modal === "status"}
        onClose={() => setModal(null)}
        title={`Change ${statusLabel ?? "Status"}`}
        size="small"
        footer={(
          <>
            <ModalButton onClick={() => setModal(null)} disabled={busy}>Cancel</ModalButton>
            <ModalButton variant="brand" onClick={doStatus} disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </ModalButton>
          </>
        )}
      >
        <div style={{ fontSize: 13, color: "#444444", marginBottom: 10 }}>
          Update {count} selected record{count === 1 ? "" : "s"}.
        </div>
        <select
          value={statusVal}
          onChange={(e) => setStatusVal(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select value</option>
          {(statusOptions ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={modal === "delete"}
        onClose={() => setModal(null)}
        title="Delete records"
        size="small"
        footer={(
          <>
            <ModalButton onClick={() => setModal(null)} disabled={busy}>Cancel</ModalButton>
            <ModalButton variant="destructive" onClick={doDelete} disabled={busy}>
              {busy ? "Deleting..." : `Delete ${count}`}
            </ModalButton>
          </>
        )}
      >
        <div style={{ fontSize: 13, color: "#444444" }}>
          Delete {count} row{count === 1 ? "" : "s"}? This cannot be undone.
        </div>
      </Modal>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontSize: 13,
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  background: "#fff",
};

function BarBtn({
  children,
  onClick,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "#fff",
        color: danger ? "#c23934" : "#0034e4",
        border: danger ? "1px solid #c23934" : "1px solid #fff",
        padding: "4px 12px",
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
