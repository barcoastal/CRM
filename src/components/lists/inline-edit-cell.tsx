"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { InlineFieldConfig } from "@/lib/lists/inline-editable-fields";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

// Module-level cache: we only fetch the user list once per page load even
// if a hundred cells across the table need it for their owner picker.
let userOptionsCache: UserOption[] | null = null;
let userOptionsPromise: Promise<UserOption[]> | null = null;

function getUserOptions(): Promise<UserOption[]> {
  if (userOptionsCache) return Promise.resolve(userOptionsCache);
  if (userOptionsPromise) return userOptionsPromise;
  userOptionsPromise = fetch("/api/users?limit=200")
    .then((r) => (r.ok ? r.json() : { users: [] }))
    .then((d: { users?: UserOption[] }) => {
      userOptionsCache = d.users ?? [];
      return userOptionsCache;
    })
    .catch(() => {
      userOptionsCache = [];
      return [];
    });
  return userOptionsPromise;
}

export interface InlineEditCellProps {
  entity: string;
  recordId: string;
  config: InlineFieldConfig;
  /** initial DB value */
  value: unknown;
  /** what to render as the static read-only label (e.g. a status pill) */
  display?: ReactNode;
  /** plain alignment for the cell content */
  align?: "left" | "right";
  /** when true (default), clicking enters edit mode */
  editable?: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Inline editable cell. Click to edit, Enter / blur to save, Esc to cancel.
 *
 * Visual states:
 *   - hover    : faint blue ring on the cell
 *   - editing  : light blue background (#f2f3ff) + visible input
 *   - saving   : grey dot
 *   - saved    : green check (#1a7d37) for 800ms
 *   - error    : red border + tooltip with the server message
 *
 * Calls POST /api/bulk-edit/<entity>?singleId=<id> with { patch: { field: val } }.
 */
export function InlineEditCell({
  entity,
  recordId,
  config,
  value,
  display,
  align,
  editable = true,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState<string>(() => toFormString(value, config));
  const [save, setSave] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [userOpts, setUserOpts] = useState<UserOption[]>(() => userOptionsCache ?? []);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Reset local value when the row's prop value changes (e.g. after refresh)
  useEffect(() => {
    if (!editing) setLocalValue(toFormString(value, config));
  }, [value, editing, config]);

  // Auto-fade the green tick
  useEffect(() => {
    if (save !== "saved") return;
    const t = setTimeout(() => setSave("idle"), 800);
    return () => clearTimeout(t);
  }, [save]);

  // Lazily fetch the user list the first time a user-picker enters edit mode
  useEffect(() => {
    if (!editing) return;
    if (config.optionsKind !== "users") return;
    if (userOpts.length > 0) return;
    let alive = true;
    void getUserOptions().then((opts) => {
      if (alive) setUserOpts(opts);
    });
    return () => {
      alive = false;
    };
  }, [editing, config.optionsKind, userOpts.length]);

  // Focus the input the moment we enter edit mode
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    if (inputRef.current && "select" in inputRef.current) {
      try {
        (inputRef.current as HTMLInputElement).select();
      } catch {
        /* ignore */
      }
    }
  }, [editing]);

  async function commit(rawNext: string) {
    setEditing(false);
    const next = fromFormString(rawNext, config);
    const prev = normalize(value, config);
    if (looselyEqual(next, prev)) {
      return;
    }
    setSave("saving");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/bulk-edit/${entity}?singleId=${encodeURIComponent(recordId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [recordId], patch: { [config.field]: next } }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        updated?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setSave("error");
        const msg = data.error ?? `Save failed (${res.status})`;
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
      setSave("saved");
    } catch (e) {
      setSave("error");
      const msg = e instanceof Error ? e.message : "Network error";
      setErrorMsg(msg);
      toast.error(msg);
    }
  }

  // ------------------------------------------------------------- read mode
  if (!editing) {
    return (
      <span
        onClick={(e) => {
          if (!editable) return;
          e.stopPropagation();
          setEditing(true);
        }}
        title={editable ? "Click to edit" : undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: editable ? "text" : undefined,
          width: "100%",
          justifyContent: align === "right" ? "flex-end" : "flex-start",
          padding: "2px 4px",
          marginLeft: -4,
          borderRadius: 3,
          border: save === "error" ? "1px solid #c23934" : "1px solid transparent",
          background: save === "saved" ? "rgba(26,125,55,0.08)" : undefined,
        }}
        className="sf-inline-cell"
      >
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {display ?? renderDisplay(value, config, userOpts)}
        </span>
        {save === "saving" && <Dot color="#706e6b" />}
        {save === "saved" && <Check />}
        {save === "error" && (
          <span title={errorMsg} aria-label="Save failed" style={{ color: "#c23934", fontSize: 11 }}>!</span>
        )}
      </span>
    );
  }

  // ------------------------------------------------------------- edit mode
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setEditing(false);
      setLocalValue(toFormString(value, config));
    }
    if (e.key === "Enter" && config.type !== "boolean") {
      e.preventDefault();
      e.stopPropagation();
      void commit(localValue);
    }
  };

  const baseInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "2px 4px",
    fontSize: 12,
    border: "1px solid #1589ee",
    borderRadius: 3,
    background: "#f2f3ff",
    outline: "none",
    fontFamily: "inherit",
    color: "#080707",
  };

  if (config.type === "enum") {
    const options =
      config.optionsKind === "users"
        ? userOpts.map((u) => ({ value: u.id, label: u.name }))
        : config.options ?? [];
    return (
      <span onClick={(e) => e.stopPropagation()} style={{ display: "block", width: "100%" }}>
        <select
          ref={(el) => { inputRef.current = el; }}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => void commit(localValue)}
          onKeyDown={onKeyDown}
          style={baseInputStyle}
        >
          <option value="">{config.optionsKind === "users" ? "Unassigned" : "(none)"}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </span>
    );
  }

  if (config.type === "boolean") {
    return (
      <span onClick={(e) => e.stopPropagation()} style={{ display: "block", width: "100%" }}>
        <input
          type="checkbox"
          checked={localValue === "true"}
          onChange={(e) => {
            const next = e.target.checked ? "true" : "false";
            setLocalValue(next);
            void commit(next);
          }}
        />
      </span>
    );
  }

  const inputType =
    config.type === "number" ? "number" : config.type === "date" ? "date" : "text";
  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "block", width: "100%" }}>
      <input
        ref={(el) => { inputRef.current = el; }}
        type={inputType}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => void commit(localValue)}
        onKeyDown={onKeyDown}
        style={baseInputStyle}
      />
    </span>
  );
}

// ------------------------------------------------------------- helpers ---

function toFormString(v: unknown, c: InlineFieldConfig): string {
  if (v == null) return "";
  if (c.type === "date") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "string") return v.slice(0, 10);
    return "";
  }
  if (c.type === "boolean") return v ? "true" : "false";
  if (c.type === "number") return String(v);
  return String(v);
}

function fromFormString(raw: string, c: InlineFieldConfig): unknown {
  if (c.type === "boolean") return raw === "true";
  if (c.type === "number") {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
  if (c.type === "date") {
    if (!raw) return null;
    return raw;  // server coerces ISO date to Date
  }
  if (c.type === "enum") {
    return raw === "" ? null : raw;
  }
  return raw === "" ? null : raw;
}

function normalize(v: unknown, c: InlineFieldConfig): unknown {
  return fromFormString(toFormString(v, c), c);
}

function looselyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function renderDisplay(v: unknown, c: InlineFieldConfig, userOpts: UserOption[]): ReactNode {
  if (c.format) return c.format(v);
  if (v == null || v === "") return <span style={{ color: "#aeaeae" }}>—</span>;
  if (c.type === "date") {
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString();
  }
  if (c.type === "boolean") return v ? "Yes" : "No";
  if (c.type === "enum" && c.optionsKind === "users") {
    const u = userOpts.find((x) => x.id === String(v));
    return u ? u.name : String(v);
  }
  return String(v);
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        animation: "sf-inline-pulse 0.9s ease-in-out infinite",
      }}
    />
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2 6.5 L5 9.5 L10 3.5"
        stroke="#1a7d37"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
