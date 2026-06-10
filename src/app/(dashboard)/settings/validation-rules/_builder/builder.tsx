"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface BuilderField {
  key: string;
  label: string;
  type: string;
}

export interface ExistingRule {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  errorMessage: string;
  errorFieldName: string | null;
  condition: unknown;
  fireOn: string;
  isActive: boolean;
}

interface BuilderProps {
  mode: "create" | "edit";
  entityType: string;
  fields: BuilderField[];
  existing?: ExistingRule;
}

interface ConditionRow {
  field: string;
  operator: string;
  value: string;
}

const OPERATOR_OPTIONS: Array<{ value: string; label: string; needsValue: boolean }> = [
  { value: "equals", label: "equals", needsValue: true },
  { value: "notEquals", label: "does not equal", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "startsWith", label: "starts with", needsValue: true },
  { value: "endsWith", label: "ends with", needsValue: true },
  { value: "gt", label: "greater than", needsValue: true },
  { value: "gte", label: "greater than or equal", needsValue: true },
  { value: "lt", label: "less than", needsValue: true },
  { value: "lte", label: "less than or equal", needsValue: true },
  { value: "isNull", label: "is empty", needsValue: false },
  { value: "isNotNull", label: "is not empty", needsValue: false },
  { value: "in", label: "is one of (comma-separated)", needsValue: true },
  { value: "notIn", label: "is not one of (comma-separated)", needsValue: true },
];

function emptyRow(defaultField: string): ConditionRow {
  return { field: defaultField, operator: "equals", value: "" };
}

function parseCondition(raw: unknown, defaultField: string): { kind: "and" | "or"; rows: ConditionRow[] } {
  if (!raw || typeof raw !== "object") return { kind: "and", rows: [] };
  const obj = raw as Record<string, unknown>;
  const kind = obj.kind === "or" ? "or" : "and";
  const conds = Array.isArray(obj.conditions) ? obj.conditions : [];
  const rows: ConditionRow[] = [];
  for (const c of conds) {
    if (!c || typeof c !== "object") continue;
    const row = c as Record<string, unknown>;
    const v = row.value;
    rows.push({
      field: typeof row.field === "string" ? row.field : defaultField,
      operator: typeof row.operator === "string" ? row.operator : "equals",
      value: v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v),
    });
  }
  return { kind, rows };
}

export function ValidationRuleBuilder({ mode, entityType, fields, existing }: BuilderProps) {
  const router = useRouter();
  const defaultField = fields[0]?.key ?? "id";

  const initial = useMemo(() => parseCondition(existing?.condition, defaultField), [existing, defaultField]);

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [errorMessage, setErrorMessage] = useState(existing?.errorMessage ?? "");
  const [errorFieldName, setErrorFieldName] = useState(existing?.errorFieldName ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [fireOn, setFireOn] = useState<"insert" | "update" | "both">(
    (existing?.fireOn as "insert" | "update" | "both" | undefined) ?? "both",
  );
  const [kind, setKind] = useState<"and" | "or">(initial.kind);
  const [rows, setRows] = useState<ConditionRow[]>(
    initial.rows.length > 0 ? initial.rows : [emptyRow(defaultField)],
  );

  const [recordSample, setRecordSample] = useState<string>(
    JSON.stringify(buildSample(entityType), null, 2),
  );
  const [testResult, setTestResult] = useState<{ matches: boolean; valueMap: Record<string, unknown> } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<ConditionRow>) {
    setRows((cur) => cur.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((cur) => [...cur, emptyRow(defaultField)]);
  }

  function removeRow(index: number) {
    setRows((cur) => (cur.length <= 1 ? cur : cur.filter((_, i) => i !== index)));
  }

  function buildCondition() {
    return {
      kind,
      conditions: rows.map((r) => {
        const op = OPERATOR_OPTIONS.find((o) => o.value === r.operator);
        const needsValue = op?.needsValue ?? true;
        return {
          field: r.field,
          operator: r.operator,
          ...(needsValue ? { value: r.value } : {}),
        };
      }),
    };
  }

  async function runTest() {
    setTestError(null);
    setTestResult(null);
    let sample: Record<string, unknown>;
    try {
      sample = JSON.parse(recordSample);
      if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
        throw new Error("Sample must be a JSON object");
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Invalid JSON");
      return;
    }
    try {
      const res = await fetch("/api/validation-rules/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          recordSample: sample,
          condition: buildCondition(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestError(data?.error ?? "Test failed");
        return;
      }
      setTestResult(data);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Network error");
    }
  }

  async function save() {
    setSaveError(null);
    if (!name.trim()) {
      setSaveError("Name is required.");
      return;
    }
    if (!errorMessage.trim()) {
      setSaveError("Error message is required.");
      return;
    }
    if (rows.length === 0) {
      setSaveError("Add at least one condition row.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        entityType,
        errorMessage: errorMessage.trim(),
        errorFieldName: errorFieldName.trim() || null,
        condition: buildCondition(),
        fireOn,
        isActive,
      };
      const url = mode === "edit" && existing ? `/api/validation-rules/${existing.id}` : "/api/validation-rules";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data?.error ?? "Save failed");
        setSubmitting(false);
        return;
      }
      router.push("/settings/validation-rules");
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  async function deleteRule() {
    if (!existing) return;
    if (!confirm("Delete this validation rule? This cannot be undone.")) return;
    setSubmitting(true);
    const res = await fetch(`/api/validation-rules/${existing.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data?.error ?? "Delete failed");
      setSubmitting(false);
      return;
    }
    router.push("/settings/validation-rules");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <header style={pageHeader}>
        <div>
          <div style={breadcrumb}>
            <Link href="/settings/validation-rules" style={crumbLink}>Validation Rules</Link>
            <span style={crumbSep}>/</span>
            <span>{mode === "edit" ? "Edit" : "New"}</span>
          </div>
          <h1 style={pageTitle}>
            {mode === "edit" ? existing?.name : `New ${entityType} Validation Rule`}
          </h1>
          <p style={pageSubtitle}>
            Block writes that violate this rule. When the condition matches a
            record being saved, the save aborts with the error message below.
          </p>
        </div>
      </header>

      <section style={card}>
        <h2 style={sectionTitle}>Details</h2>
        <div style={formGrid}>
          <Field label="Rule Name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} style={input} placeholder="Lead requires phone or email" />
          </Field>
          <Field label="Entity Type">
            <input value={entityType} readOnly style={{ ...input, background: "#f9fafb" }} />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={textarea} rows={2} placeholder="Optional. What this rule prevents and why." />
          </Field>
          <Field label="Error Message" required>
            <textarea value={errorMessage} onChange={(e) => setErrorMessage(e.target.value)} style={textarea} rows={2} placeholder="A lead must have either a phone number or an email address." />
          </Field>
          <Field label="Error Field Name (optional)">
            <select value={errorFieldName} onChange={(e) => setErrorFieldName(e.target.value)} style={input}>
              <option value="">(top of form)</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
              ))}
            </select>
          </Field>
          <Field label="Fire On">
            <div style={radioRow}>
              {(["insert", "update", "both"] as const).map((v) => (
                <label key={v} style={radioLabel}>
                  <input
                    type="radio"
                    name="fireOn"
                    value={v}
                    checked={fireOn === v}
                    onChange={() => setFireOn(v)}
                  />
                  <span style={{ textTransform: "capitalize" }}>{v}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Status">
            <label style={radioLabel}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Active (rule runs at write time)</span>
            </label>
          </Field>
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={sectionTitle}>Condition</h2>
          <div style={kindToggleWrap}>
            <span style={kindToggleLabel}>Outer:</span>
            {(["and", "or"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                style={kind === k ? kindBtnActive : kindBtn}
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <p style={hintText}>
          The rule fires when this condition evaluates to true. With AND every row must match.
          With OR at least one row must match.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row, idx) => {
            const op = OPERATOR_OPTIONS.find((o) => o.value === row.operator);
            const needsValue = op?.needsValue ?? true;
            return (
              <div key={idx} style={conditionRow}>
                <select
                  value={row.field}
                  onChange={(e) => updateRow(idx, { field: e.target.value })}
                  style={{ ...input, flex: 2 }}
                >
                  {fields.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
                <select
                  value={row.operator}
                  onChange={(e) => updateRow(idx, { operator: e.target.value })}
                  style={{ ...input, flex: 2 }}
                >
                  {OPERATOR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input
                  value={row.value}
                  onChange={(e) => updateRow(idx, { value: e.target.value })}
                  placeholder={needsValue ? "value" : "(no value needed)"}
                  disabled={!needsValue}
                  style={{ ...input, flex: 2, background: needsValue ? "#fff" : "#f3f4f6" }}
                />
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  style={removeBtn}
                  title="Remove condition"
                  disabled={rows.length <= 1}
                >
                  x
                </button>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={addRow} style={addBtn}>
          + Add Condition
        </button>
      </section>

      <section style={card}>
        <h2 style={sectionTitle}>Test</h2>
        <p style={hintText}>
          Paste a sample record (JSON) and run the rule against it. This does not save anything.
        </p>
        <textarea
          value={recordSample}
          onChange={(e) => setRecordSample(e.target.value)}
          style={{ ...textarea, minHeight: 200, fontFamily: "ui-monospace, Menlo, monospace" }}
        />
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={runTest} style={secondaryBtn}>
            Run Test
          </button>
          {testResult && (
            <span style={testResult.matches ? testHitChip : testMissChip}>
              {testResult.matches ? "Rule FIRES (record would be rejected)" : "Rule does not fire"}
            </span>
          )}
          {testError && <span style={errorText}>{testError}</span>}
        </div>
        {testResult && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#54595e", marginBottom: 4 }}>
              Resolved field values
            </div>
            <pre style={resolvedPre}>{JSON.stringify(testResult.valueMap, null, 2)}</pre>
          </div>
        )}
      </section>

      <div style={footerBar}>
        <div>
          {saveError && <span style={errorText}>{saveError}</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {mode === "edit" && (
            <button type="button" onClick={deleteRule} style={dangerBtn} disabled={submitting}>
              Delete
            </button>
          )}
          <Link href="/settings/validation-rules" style={cancelBtn}>
            Cancel
          </Link>
          <button type="button" onClick={save} style={primaryBtn} disabled={submitting}>
            {submitting ? "Saving..." : mode === "edit" ? "Save Rule" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={fieldLabel}>
        {label}
        {required && <span style={{ color: "#dc2626", marginLeft: 4 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

function buildSample(entityType: string): Record<string, unknown> {
  switch (entityType) {
    case "Lead":
      return {
        businessName: "Acme Co",
        contactName: "Jane Doe",
        phone: null,
        email: null,
        status: "Open",
        annualRevenue: 250000,
      };
    case "Opportunity":
      return { name: "Acme Deal", stage: "Qualification", amount: 0, totalDebt: 100000 };
    case "Account":
      return { name: "Acme Co", stage: "Active", clientStatus: "Active", currentTotalDebt: 100000 };
    case "Case":
      return { caseNumber: "00001234", subject: "Bank change", status: "New", priority: "Medium" };
    case "Task":
      return { subject: "Follow up", type: "TASK", status: "OPEN", disposition: null };
    case "Event":
      return { subject: "Discovery call", status: "PLANNED", startAt: new Date().toISOString() };
    default:
      return {};
  }
}

const pageHeader: React.CSSProperties = {
  background: "#fff",
  padding: "16px 24px",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  marginBottom: 16,
};
const pageTitle: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 22,
  fontWeight: 700,
  margin: 0,
  color: "#0a0a0a",
};
const pageSubtitle: React.CSSProperties = {
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 13,
  color: "#54595e",
  marginTop: 6,
  marginBottom: 0,
  maxWidth: 760,
};
const breadcrumb: React.CSSProperties = {
  fontSize: 12,
  color: "#54595e",
  fontFamily: "Manrope, system-ui, sans-serif",
  marginBottom: 4,
};
const crumbLink: React.CSSProperties = { color: "#3052ff", textDecoration: "none" };
const crumbSep: React.CSSProperties = { margin: "0 6px", color: "#9ca3af" };
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
  fontFamily: "Manrope, system-ui, sans-serif",
};
const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#0a0a0a",
  margin: "0 0 8px 0",
};
const hintText: React.CSSProperties = {
  fontSize: 12,
  color: "#54595e",
  marginTop: 0,
  marginBottom: 10,
};
const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};
const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#54595e",
  marginBottom: 4,
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "Manrope, system-ui, sans-serif",
  color: "#0a0a0a",
  background: "#fff",
  boxSizing: "border-box",
};
const textarea: React.CSSProperties = { ...input, resize: "vertical", lineHeight: 1.5 };
const radioRow: React.CSSProperties = { display: "flex", gap: 12, marginTop: 4 };
const radioLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  color: "#0a0a0a",
};
const conditionRow: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center" };
const removeBtn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  color: "#6b7280",
  borderRadius: 6,
  width: 32,
  height: 32,
  cursor: "pointer",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const addBtn: React.CSSProperties = {
  marginTop: 10,
  background: "#fff",
  border: "1px dashed #3052ff",
  color: "#3052ff",
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontFamily: "Manrope, system-ui, sans-serif",
  fontSize: 12,
  fontWeight: 600,
};
const kindToggleWrap: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6 };
const kindToggleLabel: React.CSSProperties = { fontSize: 11, color: "#54595e", fontWeight: 600 };
const kindBtn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  color: "#54595e",
  padding: "4px 10px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};
const kindBtnActive: React.CSSProperties = {
  background: "#3052ff",
  border: "1px solid #3052ff",
  color: "#fff",
  padding: "4px 10px",
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};
const footerBar: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 16,
  fontFamily: "Manrope, system-ui, sans-serif",
};
const primaryBtn: React.CSSProperties = {
  background: "#3052ff",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "Manrope, system-ui, sans-serif",
  cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  background: "#fff",
  color: "#3052ff",
  border: "1px solid #3052ff",
  padding: "6px 12px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "Manrope, system-ui, sans-serif",
  cursor: "pointer",
};
const cancelBtn: React.CSSProperties = {
  background: "#fff",
  color: "#54595e",
  border: "1px solid #e5e7eb",
  padding: "8px 16px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  fontFamily: "Manrope, system-ui, sans-serif",
};
const dangerBtn: React.CSSProperties = {
  background: "#fff",
  color: "#dc2626",
  border: "1px solid #dc2626",
  padding: "8px 16px",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "Manrope, system-ui, sans-serif",
  cursor: "pointer",
};
const errorText: React.CSSProperties = {
  color: "#dc2626",
  fontSize: 12,
  fontWeight: 600,
};
const testHitChip: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: "4px 10px",
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 700,
};
const testMissChip: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: "4px 10px",
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 700,
};
const resolvedPre: React.CSSProperties = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 6,
  padding: 10,
  fontSize: 12,
  fontFamily: "ui-monospace, Menlo, monospace",
  overflowX: "auto",
  margin: 0,
};
