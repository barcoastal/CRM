"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KNOWN_CREDITORS } from "@/lib/creditors";

/**
 * Typeahead for picking a creditor from the known list (src/lib/creditors.ts),
 * while still allowing a custom name that is not on the list.
 *
 * - Controlled: pass `value` + `onChange` (used by the inline lead/opp forms).
 * - Uncontrolled: pass `name` so the input value is read from FormData
 *   (used by the Add Debt dialog).
 */
export interface CreditorComboboxProps {
  value?: string;
  onChange?: (v: string) => void;
  name?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}

const MAX_RESULTS = 10;

export function CreditorCombobox(props: CreditorComboboxProps) {
  const controlled = props.value !== undefined;
  const [inner, setInner] = useState(props.value ?? "");
  const val = controlled ? props.value ?? "" : inner;
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const set = (v: string) => {
    if (!controlled) setInner(v);
    props.onChange?.(v);
  };

  const matches = useMemo(() => {
    const q = val.trim().toLowerCase();
    if (!q) return KNOWN_CREDITORS.slice(0, MAX_RESULTS);
    const starts: string[] = [];
    const incl: string[] = [];
    for (const c of KNOWN_CREDITORS) {
      const lc = c.toLowerCase();
      if (lc.startsWith(q)) starts.push(c);
      else if (lc.includes(q)) incl.push(c);
    }
    return [...starts, ...incl].slice(0, MAX_RESULTS);
  }, [val]);

  const isCustom = val.trim().length > 0 && !KNOWN_CREDITORS.some((c) => c.toLowerCase() === val.trim().toLowerCase());

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(c: string) {
    set(c);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHi((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && matches[hi]) {
        e.preventDefault();
        choose(matches[hi]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <input
        id={props.id}
        name={props.name}
        required={props.required}
        autoFocus={props.autoFocus}
        autoComplete="off"
        placeholder={props.placeholder ?? "Start typing a creditor..."}
        className={props.className}
        style={props.style}
        value={val}
        onChange={(e) => {
          set(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      {open && (matches.length > 0 || isCustom) && (
        <ul
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            zIndex: 60,
            margin: 0,
            padding: 4,
            listStyle: "none",
            background: "#fff",
            border: "1px solid #d8dde6",
            borderRadius: 6,
            boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {isCustom && (
            <li
              onMouseDown={(e) => {
                e.preventDefault();
                choose(val.trim());
              }}
              style={{
                padding: "7px 10px",
                fontSize: 13,
                color: "#3e3e3c",
                cursor: "pointer",
                borderBottom: matches.length ? "1px solid #f3f3f3" : undefined,
              }}
            >
              Use <strong>&ldquo;{val.trim()}&rdquo;</strong>{" "}
              <span style={{ color: "#706e6b" }}>(not in list)</span>
            </li>
          )}
          {matches.map((c, i) => (
            <li
              key={c}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(c);
              }}
              onMouseEnter={() => setHi(i)}
              style={{
                padding: "7px 10px",
                fontSize: 13,
                color: "#080707",
                cursor: "pointer",
                borderRadius: 4,
                background: i === hi ? "#eef4fb" : "#fff",
              }}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
