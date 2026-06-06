"use client";
import { useMemo, useState } from "react";
import { Section } from "@/components/slds/section";

interface SfDataSectionProps {
  sfDataJson: string | null | undefined;
  sfId: string | null | undefined;
  title?: string;
}

function prettyKey(k: string): string {
  return k
    .replace(/__c$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
  }
  return s;
}

export function SfDataSection({ sfDataJson, sfId, title = "All Salesforce Fields" }: SfDataSectionProps) {
  const [filter, setFilter] = useState("");

  const data = useMemo<Record<string, unknown> | null>(() => {
    if (!sfDataJson) return null;
    try { return JSON.parse(sfDataJson); } catch { return null; }
  }, [sfDataJson]);

  const keys = useMemo(() => {
    if (!data) return [] as string[];
    return Object.keys(data).filter((k) => {
      const v = data[k];
      if (v == null || v === "") return false;
      return true;
    }).sort();
  }, [data]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter((k) => k.toLowerCase().includes(q) || String(data?.[k] ?? "").toLowerCase().includes(q));
  }, [keys, filter, data]);

  if (!data) {
    return (
      <Section title={title}>
        <div style={{ fontSize: 13, color: "#706e6b", padding: 12 }}>
          {sfId ? `No Salesforce data on file for sfId ${sfId}.` : "Record was not imported from Salesforce."}
        </div>
      </Section>
    );
  }

  return (
    <Section title={`${title} (${keys.length})`}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #ebe9e7" }}>
        <input
          type="search"
          placeholder="Filter fields…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 10px",
            border: "1px solid #d0d0d0",
            borderRadius: 4,
            fontSize: 13,
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(280px, 2fr)", gap: 0, fontSize: 13 }}>
        {visible.map((k) => (
          <FieldRow key={k} label={prettyKey(k)} rawKey={k} value={formatValue(data[k])} />
        ))}
      </div>
      {visible.length === 0 && (
        <div style={{ padding: 16, fontSize: 13, color: "#706e6b" }}>No fields match “{filter}”.</div>
      )}
    </Section>
  );
}

function FieldRow({ label, rawKey, value }: { label: string; rawKey: string; value: string }) {
  return (
    <>
      <div style={{
        padding: "8px 12px",
        borderBottom: "1px solid #f3f2f2",
        background: "#fafaf9",
        fontWeight: 500,
        color: "#3e3e3c",
      }} title={rawKey}>
        {label}
      </div>
      <div style={{
        padding: "8px 12px",
        borderBottom: "1px solid #f3f2f2",
        wordBreak: "break-word",
        color: "#080707",
      }}>
        {value}
      </div>
    </>
  );
}
