"use client";

/* ------------------------------------------------------------------ */
/* SF list page — interactive islands                                 */
/*                                                                    */
/* This file is the only "use client" surface of the SF list page.    */
/* It exports a SelectionProvider that wraps the table so child       */
/* checkboxes / mass-action toolbar share React state instead of      */
/* DOM custom events (the old approach which couldn't power a toolbar */
/* that needs to know how many rows are selected).                    */
/*                                                                    */
/* Server-component-friendly children pass *ids* and *index* as       */
/* serializable props; selection state lives entirely client-side.    */
/* ------------------------------------------------------------------ */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Modal, ModalButton } from "./modal";

/* ====================================================================
 * Selection context
 * ================================================================== */

interface SelectionState {
  ids: string[];
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
}

const SelectionCtx = createContext<SelectionState | null>(null);

export function SfSelectionProvider({
  ids,
  children,
}: {
  ids: string[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // when the ids on the page change (after sort / search / pagination), drop
  // any selections that no longer exist
  const idsKey = ids.join("|");
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (ids.includes(id)) next.add(id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === ids.length) return new Set();
      return new Set(ids);
    });
  }, [ids]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const value = useMemo(
    () => ({ ids, selected, toggle, toggleAll, clear }),
    [ids, selected, toggle, toggleAll, clear],
  );

  return <SelectionCtx.Provider value={value}>{children}</SelectionCtx.Provider>;
}

function useSelection(): SelectionState {
  const ctx = useContext(SelectionCtx);
  if (!ctx) throw new Error("useSelection must be inside SfSelectionProvider");
  return ctx;
}

/* ====================================================================
 * Search box
 * ================================================================== */

export function SfListSearch({
  pathname,
  preservedParams,
  initialValue,
}: {
  pathname: string;
  preservedParams: Record<string, string>;
  initialValue: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function push(v: string) {
    const sp = new URLSearchParams();
    for (const [k, val] of Object.entries(preservedParams)) {
      if (val) sp.set(k, val);
    }
    if (v.trim().length > 0) sp.set("search", v.trim());
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function onChange(v: string) {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(v), 350);
  }

  return (
    <div style={{ position: "relative", width: 240 }}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: 8,
          top: "50%",
          transform: "translateY(-50%)",
          fill: "#706e6b",
        }}
      >
        <path d="M11 4a7 7 0 1 0 4.193 12.572l3.118 3.118 1.414-1.414-3.118-3.118A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" />
      </svg>
      <input
        type="search"
        placeholder="Search this list..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (timer.current) clearTimeout(timer.current);
            push(value);
          }
        }}
        style={{
          width: "100%",
          padding: "4px 8px 4px 26px",
          fontSize: 13,
          border: "1px solid #dddbda",
          borderRadius: 4,
          outline: "none",
          background: "#fff",
          color: "#080707",
        }}
      />
    </div>
  );
}

/* ====================================================================
 * Row checkbox
 * ================================================================== */

export function SfRowCheckbox({
  id,
  rowIndex,
}: {
  id: string;
  rowIndex: number;
}) {
  const { selected, toggle } = useSelection();
  const checked = selected.has(id);

  return (
    <span
      className="slds-checkbox slds-checkbox_standalone"
      style={{ display: "inline-flex", alignItems: "center" }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        aria-label={`Select row ${rowIndex}`}
        checked={checked}
        onChange={() => toggle(id)}
        onClick={(e) => e.stopPropagation()}
      />
      <span className="slds-checkbox_faux" />
    </span>
  );
}

/* ====================================================================
 * Select-all checkbox
 * ================================================================== */

export function SfSelectAllCheckbox() {
  const { selected, ids, toggleAll } = useSelection();
  const checked = ids.length > 0 && selected.size === ids.length;

  return (
    <span
      className="slds-checkbox slds-checkbox_standalone"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <input
        type="checkbox"
        aria-label="Select all"
        checked={checked}
        onChange={toggleAll}
      />
      <span className="slds-checkbox_faux" />
    </span>
  );
}

/* ====================================================================
 * Clickable row wrapper — TR that navigates to href on click
 * (except when click target is inside the checkbox, a link, or button)
 * ================================================================== */

export function SfRowTr({
  id,
  href,
  children,
}: {
  id: string;
  href?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { selected } = useSelection();
  const isSelected = selected.has(id);

  function handleClick(e: React.MouseEvent<HTMLTableRowElement>) {
    if (!href) return;
    const target = e.target as HTMLElement;
    // Don't navigate when clicking interactive children
    if (target.closest("input, button, a, label, select, textarea")) return;
    router.push(href);
  }

  return (
    <tr
      className="slds-hint-parent sf-row"
      onClick={handleClick}
      style={{
        cursor: href ? "pointer" : undefined,
        background: isSelected ? "#f4f9fd" : undefined,
      }}
    >
      {children}
    </tr>
  );
}

/* ====================================================================
 * Mass actions toolbar
 * ================================================================== */

export interface SfStatusOption {
  value: string;
  label: string;
}

export type SfEntity =
  | "lead"
  | "opportunity"
  | "account"
  | "contact"
  | "case"
  | "task"
  | "event";

export interface SfMassToolbarConfig {
  entity: SfEntity;
  /** Status (lead) or Stage (opp) or RecordType (account) options for Change Status */
  statusField?: "status" | "stage" | "recordType";
  statusLabel?: string;
  statusOptions?: SfStatusOption[];
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export function SfMassActionsToolbar({ config }: { config: SfMassToolbarConfig }) {
  const { selected, ids, clear } = useSelection();
  const router = useRouter();
  const count = selected.size;
  const [modal, setModal] = useState<
    "owner" | "status" | "email" | "delete" | null
  >(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [statusValue, setStatusValue] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [busy, setBusy] = useState(false);

  // load users when an owner modal opens
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

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  async function changeOwner() {
    if (!ownerId) {
      toast.error("Pick a user");
      return;
    }
    setBusy(true);
    try {
      const ownerField = config.entity === "account" || config.entity === "contact" ? "ownerId" : "assignedToId";
      const res = await fetch(`/api/${pluralize(config.entity)}/bulk-update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, [ownerField]: ownerId }),
      });
      const data = (await res.json()) as { ok: boolean; updated?: number; error?: string };
      if (data.ok) {
        toast.success(`Updated owner on ${data.updated ?? selectedIds.length} record${data.updated === 1 ? "" : "s"}`);
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

  async function changeStatus() {
    if (!statusValue || !config.statusField) {
      toast.error("Pick a value");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/${pluralize(config.entity)}/bulk-update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, [config.statusField]: statusValue }),
      });
      const data = (await res.json()) as { ok: boolean; updated?: number; error?: string };
      if (data.ok) {
        toast.success(`Updated ${config.statusLabel?.toLowerCase() ?? "status"} on ${data.updated ?? selectedIds.length} record${data.updated === 1 ? "" : "s"}`);
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

  async function deleteSelected() {
    setBusy(true);
    try {
      const res = await fetch(`/api/bulk-edit/${config.entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, delete: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; deleted?: number; error?: string };
      if (data.ok) {
        toast.success(`Deleted ${data.deleted ?? selectedIds.length} record${(data.deleted ?? selectedIds.length) === 1 ? "" : "s"}`);
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

  async function sendEmail() {
    if (!subject.trim()) {
      toast.error("Subject required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/${pluralize(config.entity)}/bulk-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          subject,
          bodyText: bodyText || null,
          sendNow: true,
        }),
      });
      const data = (await res.json()) as { ok: boolean; sent?: number; queued?: number; skipped?: number; error?: string };
      if (data.ok) {
        toast.success(
          `Sent ${data.sent ?? 0} of ${data.queued ?? 0} email${data.queued === 1 ? "" : "s"}` +
            (data.skipped ? ` · ${data.skipped} skipped (no email)` : ""),
        );
        setModal(null);
        setSubject("");
        setBodyText("");
        clear();
      } else {
        toast.error(data.error ?? "Send failed");
      }
    } finally {
      setBusy(false);
    }
  }

  if (count === 0) return null;

  const allInPageSelected = ids.length > 0 && count === ids.length;

  return (
    <>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "#0070d2",
          color: "#fff",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderTop: "1px solid #005fb2",
          borderLeft: "1px solid #005fb2",
          borderRight: "1px solid #005fb2",
          fontSize: 13,
          fontFamily:
            "'Salesforce Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <span style={{ fontWeight: 700 }}>
          {count} item{count === 1 ? "" : "s"} selected
          {allInPageSelected ? " (this page)" : ""}
        </span>
        <div style={{ flex: 1 }} />
        <ToolbarBtn onClick={() => { setOwnerId(""); setModal("owner"); }}>Change Owner</ToolbarBtn>
        {config.statusField && config.statusOptions && (
          <ToolbarBtn onClick={() => { setStatusValue(""); setModal("status"); }}>
            Change {config.statusLabel ?? "Status"}
          </ToolbarBtn>
        )}
        <ToolbarBtn onClick={() => setModal("email")}>Send Email</ToolbarBtn>
        <ToolbarBtn onClick={() => toast("Add to Campaign coming soon")}>Add to Campaign</ToolbarBtn>
        <ToolbarBtn onClick={() => setModal("delete")} danger>Delete</ToolbarBtn>
        <button
          onClick={clear}
          aria-label="Clear selection"
          style={{
            background: "transparent",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            fontSize: 18,
            padding: "2px 6px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Change Owner modal */}
      <Modal
        open={modal === "owner"}
        onClose={() => setModal(null)}
        title="Change Owner"
        size="small"
        footer={
          <>
            <ModalButton onClick={() => setModal(null)} disabled={busy}>Cancel</ModalButton>
            <ModalButton variant="brand" onClick={changeOwner} disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </ModalButton>
          </>
        }
      >
        <div style={{ fontSize: 13, color: "#3e3e3c", marginBottom: 12 }}>
          Reassign {count} selected record{count === 1 ? "" : "s"} to a different owner.
        </div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#3e3e3c", marginBottom: 4 }}>
          New Owner
        </label>
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 8px",
            fontSize: 13,
            border: "1px solid #dddbda",
            borderRadius: 4,
            background: "#fff",
          }}
        >
          <option value="">— Select user —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>
      </Modal>

      {/* Change Status modal */}
      <Modal
        open={modal === "status"}
        onClose={() => setModal(null)}
        title={`Change ${config.statusLabel ?? "Status"}`}
        size="small"
        footer={
          <>
            <ModalButton onClick={() => setModal(null)} disabled={busy}>Cancel</ModalButton>
            <ModalButton variant="brand" onClick={changeStatus} disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </ModalButton>
          </>
        }
      >
        <div style={{ fontSize: 13, color: "#3e3e3c", marginBottom: 12 }}>
          Update {count} selected record{count === 1 ? "" : "s"}.
        </div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#3e3e3c", marginBottom: 4 }}>
          New {config.statusLabel ?? "Status"}
        </label>
        <select
          value={statusValue}
          onChange={(e) => setStatusValue(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 8px",
            fontSize: 13,
            border: "1px solid #dddbda",
            borderRadius: 4,
            background: "#fff",
          }}
        >
          <option value="">— Select value —</option>
          {(config.statusOptions ?? []).map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </Modal>

      {/* Send Email modal */}
      <Modal
        open={modal === "email"}
        onClose={() => setModal(null)}
        title={`Send Email to ${count} ${config.entity === "opportunity" ? "Opportunit" : config.entity}${config.entity === "opportunity" ? (count === 1 ? "y" : "ies") : count === 1 ? "" : "s"}`}
        size="medium"
        footer={
          <>
            <ModalButton onClick={() => setModal(null)} disabled={busy}>Cancel</ModalButton>
            <ModalButton variant="brand" onClick={sendEmail} disabled={busy}>
              {busy ? "Sending..." : "Send"}
            </ModalButton>
          </>
        }
      >
        <div style={{ fontSize: 13, color: "#3e3e3c", marginBottom: 12 }}>
          One email per recipient. Records without an email address are skipped.
        </div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#3e3e3c", marginBottom: 4 }}>
          Subject
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 8px",
            fontSize: 13,
            border: "1px solid #dddbda",
            borderRadius: 4,
            marginBottom: 12,
          }}
        />
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#3e3e3c", marginBottom: 4 }}>
          Message
        </label>
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={10}
          style={{
            width: "100%",
            padding: "6px 8px",
            fontSize: 13,
            border: "1px solid #dddbda",
            borderRadius: 4,
            resize: "vertical",
            fontFamily: "inherit",
          }}
        />
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={modal === "delete"}
        onClose={() => setModal(null)}
        title="Delete records"
        size="small"
        footer={
          <>
            <ModalButton onClick={() => setModal(null)} disabled={busy}>Cancel</ModalButton>
            <ModalButton variant="destructive" onClick={deleteSelected} disabled={busy}>
              {busy ? "Deleting..." : `Delete ${count}`}
            </ModalButton>
          </>
        }
      >
        <div style={{ fontSize: 13, color: "#3e3e3c" }}>
          Delete {count} row{count === 1 ? "" : "s"}? This cannot be undone.
        </div>
      </Modal>
    </>
  );
}

function ToolbarBtn({
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
      onClick={onClick}
      style={{
        background: "#fff",
        color: danger ? "#c23934" : "#0070d2",
        border: "1px solid #fff",
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

function pluralize(entity: SfEntity): string {
  switch (entity) {
    case "lead": return "leads";
    case "opportunity": return "opportunities";
    case "account": return "accounts";
    case "contact": return "contacts";
    case "case": return "cases";
    case "task": return "tasks";
    case "event": return "events";
  }
}

/* ====================================================================
 * View picker — switches between named saved views via ?view= param
 * ================================================================== */

export interface SfViewOption {
  value: string;
  label: string;
}

export function SfViewPicker({
  views,
  current,
}: {
  views: SfViewOption[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const currentLabel = views.find((v) => v.value === current)?.label ?? views[0]?.label ?? "Recently Viewed";
  const filtered = q.trim() ? views.filter((v) => v.label.toLowerCase().includes(q.trim().toLowerCase())) : views;

  function selectView(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    // dropping search + sort + dir when switching views so the new view
    // starts from a clean state — matches SF behaviour
    sp.delete("search");
    sp.delete("sort");
    sp.delete("dir");
    if (value && value !== "recent") sp.set("view", value);
    else sp.delete("view");
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 18,
          fontWeight: 700,
          color: "#080707",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          lineHeight: 1.2,
        }}
      >
        {currentLabel}
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ fill: "#080707" }}>
          <path d="M2 4l4 4 4-4z" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            background: "#fff",
            border: "1px solid #d8dde6",
            borderRadius: 4,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            minWidth: 320,
            zIndex: 25,
            marginTop: 4,
            padding: "4px 0",
          }}
        >
          {views.length > 8 && (
            <div style={{ padding: "8px 12px 6px" }}>
              <input
                type="search"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search lists..."
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  border: "1px solid #d8dde6",
                  borderRadius: 4,
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
          <div
            style={{
              padding: "8px 16px 4px",
              fontSize: 11,
              fontWeight: 700,
              color: "#706e6b",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            LIST VIEWS
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {filtered.map((v) => {
              const active = v.value === current;
              return (
                <button
                  key={v.value}
                  onClick={() => selectView(v.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 16px",
                    fontSize: 13,
                    background: active ? "#f4f6f9" : "transparent",
                    color: "#080707",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: active ? 700 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "#f3f2f2";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {v.label}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: "8px 16px", fontSize: 13, color: "#706e6b" }}>No lists match.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
