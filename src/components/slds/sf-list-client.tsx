"use client";

/* ------------------------------------------------------------------ */
/* SF list page — interactive islands                                 */
/*                                                                    */
/* These are the only "use client" pieces of the SF list. They take   */
/* only serializable props (strings, arrays of ids). The parent SF    */
/* list page is a pure server component.                              */
/* ------------------------------------------------------------------ */

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/* ----------------------- Search box ------------------------------- */

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

  // sync URL on user pause (debounced) or Enter
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

/* ----------------------- Row checkbox ----------------------------- */
/*  Client-only state; not persisted. Just for visual selection.     */

const checkedRowEvent = "sf-list-row-toggle";

interface RowToggleDetail {
  id: string;
  checked: boolean;
}

export function SfRowCheckbox({
  id,
  rowIndex,
}: {
  id: string;
  rowIndex: number;
}) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    function onAll(e: Event) {
      const ce = e as CustomEvent<{ checked: boolean }>;
      setChecked(ce.detail.checked);
    }
    window.addEventListener("sf-list-select-all", onAll);
    return () => window.removeEventListener("sf-list-select-all", onAll);
  }, []);

  function toggle() {
    const next = !checked;
    setChecked(next);
    window.dispatchEvent(
      new CustomEvent<RowToggleDetail>(checkedRowEvent, {
        detail: { id, checked: next },
      }),
    );
  }

  return (
    <span
      className="slds-checkbox slds-checkbox_standalone"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <input
        type="checkbox"
        aria-label={`Select row ${rowIndex}`}
        checked={checked}
        onChange={toggle}
      />
      <span className="slds-checkbox_faux" />
    </span>
  );
}

/* ----------------------- Select-all checkbox ---------------------- */

export function SfSelectAllCheckbox({ ids }: { ids: string[] }) {
  const [checked, setChecked] = useState(false);
  // serialized rowIds so effect deps stay stable
  const idsKey = ids.join(",");

  useEffect(() => {
    function onRow(e: Event) {
      const ce = e as CustomEvent<RowToggleDetail>;
      if (!ce.detail.checked) setChecked(false);
    }
    window.addEventListener(checkedRowEvent, onRow);
    return () => window.removeEventListener(checkedRowEvent, onRow);
  }, [idsKey]);

  function toggle() {
    const next = !checked;
    setChecked(next);
    window.dispatchEvent(
      new CustomEvent("sf-list-select-all", { detail: { checked: next } }),
    );
  }

  return (
    <span
      className="slds-checkbox slds-checkbox_standalone"
      style={{ display: "inline-flex", alignItems: "center" }}
    >
      <input
        type="checkbox"
        aria-label="Select all"
        checked={checked}
        onChange={toggle}
      />
      <span className="slds-checkbox_faux" />
    </span>
  );
}
