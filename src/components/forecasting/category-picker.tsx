"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  FORECAST_CATEGORIES,
  type ForecastCategory,
} from "@/lib/forecasting/categories";

/**
 * Compact dropdown bound to a single Opportunity's forecastCategory.
 * POSTs to /api/forecasting/categories on change.
 *
 * Used on the forecasting page table, the pipeline waterfall, and inline
 * next to Stage on the Opportunity detail header.
 */
export function CategoryPicker({
  opportunityId,
  value,
  size = "md",
  onChanged,
}: {
  opportunityId: string;
  value: ForecastCategory;
  size?: "sm" | "md";
  onChanged?: (next: ForecastCategory) => void;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<ForecastCategory>(value);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const small = size === "sm";

  async function handleChange(next: ForecastCategory) {
    if (next === current) return;
    const prev = current;
    setCurrent(next);
    setErr(null);
    try {
      const res = await fetch("/api/forecasting/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, category: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Save failed");
      }
      onChanged?.(next);
      startTransition(() => router.refresh());
    } catch (e) {
      setCurrent(prev);
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 8,
          background: CATEGORY_COLOR[current],
          flexShrink: 0,
        }}
      />
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value as ForecastCategory)}
        disabled={pending}
        style={{
          fontSize: small ? 11 : 13,
          padding: small ? "2px 4px" : "4px 8px",
          border: "1px solid #d8dde6",
          borderRadius: 4,
          background: "#fff",
          color: "#080707",
          fontWeight: 600,
          cursor: pending ? "wait" : "pointer",
          minWidth: small ? 90 : 110,
        }}
        title={err ?? `Forecast category: ${CATEGORY_LABEL[current]}`}
      >
        {FORECAST_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * Read-only badge for places that don't need editing.
 */
export function CategoryBadge({ value }: { value: ForecastCategory }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 12,
        background: "#f3f2f2",
        color: "#080707",
        border: `1px solid ${CATEGORY_COLOR[value]}`,
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: 8, background: CATEGORY_COLOR[value] }}
      />
      {CATEGORY_LABEL[value]}
    </span>
  );
}
