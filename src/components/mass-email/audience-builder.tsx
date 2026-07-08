"use client";

/**
 * Audience builder. Two modes:
 *   - "filter": pick entity (Lead/Contact) + optional filter fields (status, source, etc.)
 *   - "list":   paste a newline/comma-separated set of IDs
 *
 * Whenever the audience config changes, the parent gets a live count by
 * POSTing the current config to /api/emails/mass/audience-count.
 */

import { useEffect, useState } from "react";

export type EntityType = "Lead" | "Contact";

export interface AudienceState {
  audienceType: "filter" | "list";
  audienceFilter: {
    entityType: EntityType;
    filters: {
      status?: string;
      source?: string;
      recordType?: string;
      state?: string;
      ownerId?: string;
    };
  };
  audienceIds: string[];
}

interface Props {
  value: AudienceState;
  onChange: (next: AudienceState) => void;
  onCountChange?: (count: number) => void;
}

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CALLBACK", "ENROLLED", "CONVERTED", "LOST", "DNC"];
const LEAD_SOURCES = ["WEBSITE", "REFERRAL", "MAILER", "PURCHASED_LIST", "COLD_CALL", "SOCIAL", "OTHER"];
const LEAD_RECORD_TYPES = ["WEB", "DIRECT_MAIL", "LIST", "BUSINESS"];

export function AudienceBuilder({ value, onChange, onCountChange }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pasteText, setPasteText] = useState<string>(value.audienceIds.join("\n"));

  // Live count whenever value changes (debounced).
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/emails/mass/audience-count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audienceType: value.audienceType,
            audienceFilter: value.audienceFilter,
            audienceIds: value.audienceIds,
          }),
        });
        const data = await res.json().catch(() => ({ count: 0 }));
        if (!cancelled) {
          setCount(data.count ?? 0);
          onCountChange?.(data.count ?? 0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [value, onCountChange]);

  function updateFilter<K extends keyof AudienceState["audienceFilter"]["filters"]>(
    key: K,
    raw: string,
  ) {
    const filters = { ...value.audienceFilter.filters, [key]: raw || undefined };
    onChange({ ...value, audienceFilter: { ...value.audienceFilter, filters } });
  }

  function setEntityType(entityType: EntityType) {
    onChange({
      ...value,
      audienceFilter: { entityType, filters: {} },
      audienceIds: [],
    });
  }

  function applyPasted() {
    const ids = pasteText
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ ...value, audienceIds: ids });
  }

  const entityType = value.audienceFilter.entityType;

  return (
    <div className="space-y-4" style={{ fontFamily: "Manrope, sans-serif" }}>
      <div className="flex items-center gap-2">
        <ModePill
          active={value.audienceType === "filter"}
          onClick={() => onChange({ ...value, audienceType: "filter" })}
          label="By filter"
        />
        <ModePill
          active={value.audienceType === "list"}
          onClick={() => onChange({ ...value, audienceType: "list" })}
          label="By list of IDs"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Entity">
          <select
            className="w-full h-9 rounded border border-[#c9c9c9] px-3 text-[13px] text-[#131b2e] bg-white"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as EntityType)}
          >
            <option value="Lead">Lead</option>
            <option value="Contact">Contact</option>
          </select>
        </Field>
      </div>

      {value.audienceType === "filter" ? (
        <div className="grid grid-cols-2 gap-3">
          {entityType === "Lead" ? (
            <>
              <Field label="Status">
                <SelectField
                  value={value.audienceFilter.filters.status ?? ""}
                  onChange={(v) => updateFilter("status", v)}
                  options={LEAD_STATUSES}
                />
              </Field>
              <Field label="Source">
                <SelectField
                  value={value.audienceFilter.filters.source ?? ""}
                  onChange={(v) => updateFilter("source", v)}
                  options={LEAD_SOURCES}
                />
              </Field>
              <Field label="Record type">
                <SelectField
                  value={value.audienceFilter.filters.recordType ?? ""}
                  onChange={(v) => updateFilter("recordType", v)}
                  options={LEAD_RECORD_TYPES}
                />
              </Field>
              <Field label="State">
                <input
                  type="text"
                  maxLength={2}
                  className="w-full h-9 rounded border border-[#c9c9c9] px-3 text-[13px] text-[#131b2e]"
                  placeholder="NY, FL, etc."
                  value={value.audienceFilter.filters.state ?? ""}
                  onChange={(e) => updateFilter("state", e.target.value.toUpperCase())}
                />
              </Field>
            </>
          ) : (
            <Field label="Owner User ID (optional)">
              <input
                type="text"
                className="w-full h-9 rounded border border-[#c9c9c9] px-3 text-[13px] text-[#131b2e]"
                placeholder="cuid of owner user"
                value={value.audienceFilter.filters.ownerId ?? ""}
                onChange={(e) => updateFilter("ownerId", e.target.value)}
              />
            </Field>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Field label={`Paste ${entityType} IDs (one per line or comma separated)`}>
            <textarea
              rows={6}
              className="w-full rounded border border-[#c9c9c9] px-3 py-2 text-[13px] text-[#131b2e] font-mono"
              placeholder="cuid1&#10;cuid2&#10;cuid3"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onBlur={applyPasted}
            />
          </Field>
          <button
            type="button"
            onClick={applyPasted}
            className="px-3 py-1.5 rounded border border-[#c9c9c9] text-[12px] font-semibold text-[#131b2e] bg-white hover:bg-[#f2f3ff]"
          >
            Apply IDs
          </button>
        </div>
      )}

      <div
        className="rounded-lg px-4 py-3 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, rgba(48,82,255,0.06), rgba(48,82,255,0.02))" }}
      >
        <div className="text-[12px] text-[#444656]">Matching recipients with an email address</div>
        <div className="text-[20px] font-bold text-[#131b2e]">
          {loading ? "..." : (count ?? 0).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function ModePill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded text-[12px] font-semibold transition-colors"
      style={{
        background: active ? "linear-gradient(135deg, #0034e4, #3052ff)" : "#f2f3ff",
        color: active ? "white" : "#444656",
      }}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-1">{label}</div>
      {children}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      className="w-full h-9 rounded border border-[#c9c9c9] px-3 text-[13px] text-[#131b2e] bg-white"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Any</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
