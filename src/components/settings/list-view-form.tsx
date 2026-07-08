"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Section, FieldGrid } from "@/components/slds/section";

type Op =
  | "EQ"
  | "NEQ"
  | "CONTAINS"
  | "STARTS_WITH"
  | "IN"
  | "NOT_IN"
  | "IS_NULL"
  | "IS_NOT_NULL";

interface Row {
  field: string;
  op: Op;
  value: string;
}

const FIELDS_BY_ENTITY: Record<string, { field: string; label: string }[]> = {
  Lead: [
    { field: "recordType", label: "Record Type (WEB | DIRECT_MAIL | LIST | BUSINESS | ARCHIVED_*)" },
    { field: "status", label: "Status (NEW | CONTACTED | QUALIFIED | CALLBACK | DNC | LOST | CONVERTED)" },
    { field: "source", label: "Source (WEBSITE | REFERRAL | MAILER | PURCHASED_LIST | COLD_CALL | SOCIAL)" },
    { field: "industry", label: "Industry" },
    { field: "businessName", label: "Business Name" },
    { field: "totalDebtEst", label: "Est. Debt (numeric)" },
    { field: "assignedToId", label: "Owner User ID" },
  ],
  Account: [
    { field: "recordType", label: "Record Type" },
    { field: "industry", label: "Industry" },
    { field: "annualRevenue", label: "Annual Revenue" },
  ],
  Opportunity: [
    { field: "recordType", label: "Record Type" },
    { field: "stage", label: "Stage" },
    { field: "totalDebt", label: "Total Debt" },
  ],
  Case: [
    { field: "recordType", label: "Record Type" },
    { field: "status", label: "Status" },
    { field: "priority", label: "Priority" },
    { field: "escalationLevel", label: "Escalation Level" },
  ],
};

export function ListViewForm({ entity, returnTo }: { entity: string; returnTo?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [developerName, setDeveloperName] = useState("");
  const [rows, setRows] = useState<Row[]>([{ field: "recordType", op: "EQ", value: "" }]);
  const [sortField, setSortField] = useState("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [isShared, setIsShared] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldOptions = FIELDS_BY_ENTITY[entity] ?? [];

  function autoDev() {
    if (!developerName) {
      setDeveloperName(name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, ""));
    }
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((r) => [...r, { field: fieldOptions[0]?.field ?? "recordType", op: "EQ", value: "" }]);
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Convert rows → filters, handling IN/NOT_IN as CSV
    const filters = rows
      .filter((r) => r.field && r.op)
      .map((r) => {
        if (r.op === "IS_NULL" || r.op === "IS_NOT_NULL") {
          return { field: r.field, op: r.op };
        }
        const val = r.op === "IN" || r.op === "NOT_IN"
          ? r.value.split(",").map((s) => s.trim()).filter(Boolean)
          : r.value;
        return { field: r.field, op: r.op, value: val };
      });

    try {
      const res = await fetch("/api/list-views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity, name, developerName: developerName || null,
          filters, sortField, sortDir, isShared, isPinned,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create view");
      router.push(returnTo ? `${returnTo}?view=${data.developerName ?? data.id}` : `/${entity.toLowerCase()}s?view=${data.developerName ?? data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create view");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <header style={{
        background: "#fff", padding: "12px 20px", border: "1px solid #c9c9c9",
        borderRadius: 4, marginBottom: 12,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <Link href={returnTo ?? `/${entity.toLowerCase()}s`} style={{ fontSize: 12, color: "#0176d3", textDecoration: "none" }}>
            ← Back
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: "4px 0 0", color: "#181818" }}>
            New {entity} List View
          </h1>
        </div>
        <button type="button" onClick={() => router.back()} className="slds-button slds-button_neutral" disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="slds-button slds-button_brand" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
      </header>

      {error && (
        <div style={{
          background: "#feded2", color: "#8e1f0b", padding: 10, borderRadius: 4,
          marginBottom: 12, border: "1px solid #f3aaa1", fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <Section title="View Details">
        <FieldGrid
          fields={[
            ["List Name *", <input key="n" required value={name} onChange={(e) => setName(e.target.value)} onBlur={autoDev} className="slds-input" style={inputStyle} placeholder="My Web Leads" />],
            ["Developer Name", <input key="d" value={developerName} onChange={(e) => setDeveloperName(e.target.value)} className="slds-input" style={inputStyle} placeholder="My_Web_Leads" />],
            ["Sort Field", <select key="sf" value={sortField} onChange={(e) => setSortField(e.target.value)} style={inputStyle}>
              <option value="createdAt">Created Date</option>
              <option value="updatedAt">Last Modified</option>
              {fieldOptions.map((f) => <option key={f.field} value={f.field}>{f.field}</option>)}
            </select>],
            ["Sort Direction", <select key="sd" value={sortDir} onChange={(e) => setSortDir(e.target.value as "asc" | "desc")} style={inputStyle}>
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>],
            ["Visibility", <label key="sh" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
              Share with all users
            </label>],
            ["Pin to top", <label key="pn" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />
              Pin to top of picker
            </label>],
          ]}
        />
      </Section>

      <Section title={`Filters (${rows.length}) — all conditions must match (AND)`}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 2fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <select value={row.field} onChange={(e) => updateRow(i, { field: e.target.value })} style={inputStyle}>
              {fieldOptions.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
            </select>
            <select value={row.op} onChange={(e) => updateRow(i, { op: e.target.value as Op })} style={inputStyle}>
              <option value="EQ">Equals</option>
              <option value="NEQ">Not Equals</option>
              <option value="CONTAINS">Contains</option>
              <option value="STARTS_WITH">Starts With</option>
              <option value="IN">In (CSV)</option>
              <option value="NOT_IN">Not In (CSV)</option>
              <option value="IS_NULL">Is Empty</option>
              <option value="IS_NOT_NULL">Is Not Empty</option>
            </select>
            {row.op !== "IS_NULL" && row.op !== "IS_NOT_NULL" ? (
              <input
                value={row.value}
                onChange={(e) => updateRow(i, { value: e.target.value })}
                style={inputStyle}
                placeholder={row.op === "IN" || row.op === "NOT_IN" ? "value1,value2,value3" : "value"}
              />
            ) : (
              <span style={{ color: "#747474", fontSize: 12 }}>(no value needed)</span>
            )}
            <button type="button" onClick={() => removeRow(i)} className="slds-button slds-button_neutral">
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={addRow} className="slds-button slds-button_neutral">
          + Add Filter
        </button>
      </Section>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 10px",
  border: "1px solid #c9c9c9", borderRadius: 4, fontSize: 13, background: "#fff",
};
