"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type EntityType = "lead" | "opportunity" | "account" | "contact";
export type FieldType = "text" | "textarea" | "number" | "date" | "datetime" | "select" | "checkbox" | "email" | "phone" | "lookup";

export interface LookupOption {
  id: string;
  label: string;
  sublabel?: string;
}

export interface InlineEditableFieldProps {
  /** Label displayed to the left (SF style). */
  label: string;
  /** Current value (used both for display and as the input seed). */
  value: string | number | boolean | null | undefined;
  /** Optional pre-rendered display node. When provided, used instead of the raw value for the read view. */
  displayNode?: ReactNode;
  /** The database/SF field key to PATCH. */
  fieldKey: string;
  /** Entity type — selects the PATCH endpoint. */
  entityType: EntityType;
  /** Record id. */
  entityId: string;
  /** Input type. */
  type?: FieldType;
  /** Option list for select inputs. */
  options?: { label: string; value: string }[];
  /** For type "lookup": endpoint returning { options: [{id,label,sublabel?}] } for ?q= */
  lookupEndpoint?: string;
  /** When false, renders a row with no pencil icon. Used for system / formula fields. */
  editable?: boolean;
  /** Optional formatter for display (e.g. currency, date). */
  format?: (v: string | number | boolean | null | undefined) => ReactNode;
}

/**
 * Salesforce-style inline editable field row.
 *
 * Read mode: label (gray, ~165px) — value — pencil icon (always visible on the right).
 * Edit mode: value swaps to an input + green save and red cancel buttons.
 *
 * The pencil renders for every editable row regardless of hover — matches the SF
 * Account / Lead / Opportunity detail page screenshots in docs/sf-screenshots/.
 */
export function InlineEditableField({
  label,
  value,
  displayNode,
  fieldKey,
  entityType,
  entityId,
  type = "text",
  options,
  lookupEndpoint,
  editable = true,
  format,
}: InlineEditableFieldProps) {
  // Pad cells used to align two-column rows skip rendering entirely.
  if (label === "__PAD__") {
    return <div aria-hidden="true" style={{ minHeight: 23, padding: "2px 0" }} />;
  }

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(toInputString(value, type));
  const [committed, setCommitted] = useState<typeof value>(value);
  const [committedNode, setCommittedNode] = useState<ReactNode>(displayNode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Lookup state: typeahead suggestions + the picked record id.
  const [lookupResults, setLookupResults] = useState<LookupOption[]>([]);
  const [lookupId, setLookupId] = useState<string | null>(null);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onLookupType(q: string) {
    setDraft(q);
    setLookupId(null); // typing invalidates the previous pick
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!lookupEndpoint || q.trim().length < 2) {
      setLookupResults([]);
      return;
    }
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${lookupEndpoint}?q=${encodeURIComponent(q.trim())}`);
        const j = (await res.json()) as { options?: LookupOption[] };
        setLookupResults(j.options ?? []);
      } catch {
        setLookupResults([]);
      }
    }, 250);
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement && type === "text") {
        inputRef.current.select();
      }
    }
  }, [editing, type]);

  // Sync from props (e.g. on parent re-render after a save).
  useEffect(() => {
    if (!editing) {
      setCommitted(value);
      setDraft(toInputString(value, type));
      setCommittedNode(displayNode);
    }
  }, [value, displayNode, type, editing]);

  const isEmpty =
    committedNode == null && (committed == null || committed === "");
  const readValue: ReactNode = (() => {
    if (committedNode) return committedNode;
    if (format) return format(committed);
    if (committed == null || committed === "") return null;
    if (type === "checkbox") return committed ? "Yes" : "No";
    return String(committed);
  })();

  async function save() {
    // Lookups PATCH the picked record id, never free text.
    if (type === "lookup" && !lookupId) {
      setError("Pick a record from the list.");
      return;
    }
    setSaving(true);
    setError(null);
    const parsed = type === "lookup" ? lookupId : parseDraft(draft, type);
    // Optimistic update (lookups display the picked label, not the id)
    const prev = committed;
    const prevNode = committedNode;
    setCommitted((type === "lookup" ? draft : parsed) as typeof value);
    setCommittedNode(undefined); // fall back to raw value during save
    setEditing(false);
    try {
      const res = await fetch(`/api/${pluralize(entityType)}/${entityId}/field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldKey]: parsed }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Save failed (${res.status})`);
      }
      // Re-fetch the server component so the rest of the page (header/title,
      // related panels, derived fields) reflects the change without a manual
      // browser refresh.
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      // Revert
      setCommitted(prev);
      setCommittedNode(prevNode);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(toInputString(committed, type));
    setEditing(false);
    setError(null);
  }

  function startEdit() {
    if (!editable || saving) return;
    // Lookups start with an empty search box (the raw value is a record id,
    // not something a user should see or edit as text).
    setDraft(type === "lookup" ? "" : toInputString(committed, type));
    setLookupId(null);
    setLookupResults([]);
    setEditing(true);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    } else if (e.key === "Enter" && type !== "textarea") {
      e.preventDefault();
      void save();
    }
  }

  return (
    <div
      className="sf-ief sf-field"
      style={{
        // SF Lightning record-page field row: HORIZONTAL — label LEFT (33%),
        // value middle, action column (pencil OR save/cancel) on the far RIGHT.
        // Matches the SF Roberto Suarez Lead, Kenya Palmer Opportunity, Dakota
        // Enterprises Account and Jennifer Stamos Contact screenshots.
        display: "grid",
        gridTemplateColumns: editing ? "33% 1fr 56px" : "33% 1fr 28px",
        alignItems: "start",
        gap: 8,
        padding: "2px 0",
        minHeight: 23,
        borderBottom: "1px solid #e5e5e5",
        fontSize: 13,
        lineHeight: 1.25,
        position: "relative",
      }}
    >
      <div
        style={{
          // SF live computed: 12px BOLD #181818 labels.
          color: "#181818",
          fontWeight: 700,
          fontSize: 12,
          lineHeight: 1.25,
          wordBreak: "break-word",
          paddingTop: 1,
        }}
      >
        {label}
      </div>

      {editing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, position: "relative" }}>
          {type === "lookup" ? (
            <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={draft}
                placeholder="Search…"
                onChange={(e) => onLookupType(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
                disabled={saving}
                style={inputStyle}
              />
              {lookupResults.length > 0 && !lookupId && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "#fff",
                    border: "1px solid #c9c9c9",
                    borderRadius: 4,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.16)",
                    zIndex: 50,
                    maxHeight: 220,
                    overflowY: "auto",
                  }}
                >
                  {lookupResults.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        setLookupId(o.id);
                        setDraft(o.label);
                        setLookupResults([]);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 10px",
                        background: "transparent",
                        border: 0,
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#181818",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f2f2")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {o.label}
                      {o.sublabel && (
                        <span style={{ display: "block", fontSize: 11, color: "#747474" }}>{o.sublabel}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : type === "select" ? (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              disabled={saving}
              style={inputStyle}
            >
              <option value="">- None -</option>
              {options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : type === "checkbox" ? (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="checkbox"
              checked={draft === "true"}
              onChange={(e) => setDraft(e.target.checked ? "true" : "false")}
              onKeyDown={onKey}
              disabled={saving}
              style={{ width: 16, height: 16, marginRight: 8 }}
            />
          ) : type === "textarea" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              disabled={saving}
              rows={3}
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={inputHtmlType(type)}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              disabled={saving}
              style={inputStyle}
            />
          )}
        </div>
      ) : (
        <div
          style={{
            color: "#181818",
            minWidth: 0,
            wordBreak: "break-word",
            lineHeight: 1.4,
          }}
        >
          {isEmpty ? <span aria-hidden="true" style={{ color: "transparent" }}>-</span> : readValue}
          {error && (
            <div style={{ color: "#c23934", fontSize: 11, marginTop: 2 }}>{error}</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 2, justifyContent: "flex-end", alignSelf: "start" }}>
        {editing ? (
          <>
            <button
              type="button"
              aria-label="Save"
              title="Save"
              disabled={saving}
              onClick={() => void save()}
              style={btnStyle("#04844b")}
            >
              <svg width="12" height="12" viewBox="0 0 52 52" aria-hidden="true" style={{ fill: "#fff" }}>
                <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#check" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Cancel"
              title="Cancel"
              disabled={saving}
              onClick={cancel}
              style={btnStyle("#747474")}
            >
              <svg width="10" height="10" viewBox="0 0 52 52" aria-hidden="true" style={{ fill: "#fff" }}>
                <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#close" />
              </svg>
            </button>
          </>
        ) : editable ? (
          <button
            type="button"
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
            onClick={startEdit}
            className="sf-ief-edit"
            style={{
              background: "transparent",
              border: 0,
              cursor: "pointer",
              padding: 0,
              width: 24,
              height: 18,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.55,
              borderRadius: 3,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 52 52" aria-hidden="true" style={{ fill: "#54698d" }}>
              <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#edit" />
            </svg>
          </button>
        ) : (
          <span aria-hidden="true" style={{ display: "inline-block", width: 24, height: 18 }} />
        )}
      </div>

      <style jsx>{`
        :global(.sf-ief:hover) {
          background: #fafaf9;
        }
        :global(.sf-ief:hover .sf-ief-edit) {
          opacity: 1;
        }
        :global(.sf-ief-edit:hover) {
          background: #ecebea;
        }
      `}</style>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: 0,
    cursor: "pointer",
    padding: 0,
    width: 22,
    height: 22,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 3,
  };
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: "1px solid #1b96ff",
  background: "#fff",
  padding: "4px 8px",
  fontSize: 13,
  lineHeight: 1.25,
  borderRadius: 3,
  outline: "none",
  minWidth: 0,
};

function pluralize(entity: EntityType): string {
  // Routes live at /api/leads, /api/opportunities, /api/accounts, /api/contacts.
  // Simple lookup keeps us from needing an "ies" pluralizer.
  return entity === "opportunity" ? "opportunities" : `${entity}s`;
}

function inputHtmlType(t: FieldType): string {
  switch (t) {
    case "number":
      return "number";
    case "date":
      return "date";
    case "datetime":
      return "datetime-local";
    case "email":
      return "email";
    case "phone":
      return "tel";
    default:
      return "text";
  }
}

function toInputString(v: unknown, type: FieldType): string {
  if (v == null) return "";
  if (type === "checkbox") {
    if (typeof v === "boolean") return v ? "true" : "false";
    const s = String(v).toLowerCase();
    return ["true", "1", "yes"].includes(s) ? "true" : "false";
  }
  if (type === "date") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const d = new Date(String(v));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return "";
  }
  if (type === "datetime") {
    if (v instanceof Date) return v.toISOString().slice(0, 16);
    const d = new Date(String(v));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 16);
    return "";
  }
  return String(v);
}

function parseDraft(s: string, type: FieldType): string | number | boolean | null {
  if (s === "" && type !== "checkbox") return null;
  if (type === "number") {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "checkbox") return s === "true";
  // date / datetime / text / select / email / phone all flow through as strings;
  // the server will normalize ISO dates into Date objects.
  return s;
}
