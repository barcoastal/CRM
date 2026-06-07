"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface PersonalInfoValues {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  alias: string;
  email: string;
  username: string;
  nickname: string;
  title: string;
  companyDisplay: string;
  department: string;
  division: string;
  extension: string;
  fax: string;
  mobile: string;
  country: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
}

interface FieldDef {
  key: keyof PersonalInfoValues;
  label: string;
  type?: "text" | "textarea" | "select" | "email";
  helper?: string;
  readOnly?: boolean;
  options?: string[];
}

const DETAILS_FIELDS: FieldDef[] = [
  { key: "firstName", label: "First Name" },
  { key: "middleName", label: "Middle Name" },
  { key: "lastName", label: "Last Name" },
  { key: "suffix", label: "Suffix" },
  { key: "alias", label: "Alias" },
  { key: "email", label: "Email", type: "email" },
  { key: "username", label: "Username", readOnly: true },
  { key: "nickname", label: "Nickname" },
  { key: "title", label: "Title" },
  { key: "companyDisplay", label: "Company" },
  { key: "department", label: "Department" },
  { key: "division", label: "Division" },
  { key: "extension", label: "Extension" },
  { key: "fax", label: "Fax" },
  { key: "mobile", label: "Mobile", helper: "Example: +16000000131" },
];

const COUNTRIES = [
  "",
  "United States",
  "Canada",
  "Mexico",
  "United Kingdom",
  "Israel",
  "Australia",
  "Germany",
  "France",
];

const STATES = [
  "",
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

const ADDRESS_FIELDS: FieldDef[] = [
  { key: "country", label: "Country", type: "select", options: COUNTRIES },
  { key: "street", label: "Street", type: "textarea" },
  { key: "city", label: "City" },
  { key: "state", label: "State/Province", type: "select", options: STATES },
  { key: "postalCode", label: "Zip/Postal Code" },
];

export function PersonalInfoForm({ initial }: { initial: PersonalInfoValues }) {
  const router = useRouter();
  const [values, setValues] = useState<PersonalInfoValues>(initial);
  const [original, setOriginal] = useState<PersonalInfoValues>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const update = (k: keyof PersonalInfoValues, v: string) => {
    setValues((prev) => ({ ...prev, [k]: v }));
  };

  const isDirty = JSON.stringify(values) !== JSON.stringify(original);

  const save = async () => {
    setSaving(true);
    setToast(null);
    const prev = original;
    // optimistic
    setOriginal(values);
    try {
      const res = await fetch("/api/my-settings/personal-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      setToast({ kind: "success", text: "Your changes have been saved." });
      router.refresh();
    } catch (err) {
      setOriginal(prev);
      setToast({
        kind: "error",
        text: err instanceof Error ? err.message : "Save failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setValues(original);
    setToast(null);
  };

  const renderField = (f: FieldDef) => {
    const v = values[f.key] ?? "";
    if (f.type === "textarea") {
      return (
        <textarea
          className="ms-row-input ms-row-textarea"
          value={v}
          rows={2}
          onChange={(e) => update(f.key, e.target.value)}
          readOnly={f.readOnly}
        />
      );
    }
    if (f.type === "select") {
      return (
        <select
          className="ms-row-input"
          value={v}
          onChange={(e) => update(f.key, e.target.value)}
        >
          {(f.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt || "None"}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        className="ms-row-input"
        type={f.type ?? "text"}
        value={v}
        onChange={(e) => update(f.key, e.target.value)}
        readOnly={f.readOnly}
      />
    );
  };

  const renderRow = (f: FieldDef) => (
    <div className="ms-row" key={f.key}>
      <div className="ms-row-label">{f.label}</div>
      <div>
        {renderField(f)}
        {f.helper && <div className="ms-row-helper">{f.helper}</div>}
      </div>
      <button type="button" className="ms-row-edit-btn" aria-label={`Edit ${f.label}`} disabled={f.readOnly}>
        <svg className="ms-row-edit-icon" aria-hidden="true">
          <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#edit" />
        </svg>
      </button>
    </div>
  );

  const saveBar = (
    <div className="ms-save-bar">
      <button
        type="button"
        className="ms-btn ms-btn-secondary"
        onClick={cancel}
        disabled={saving || !isDirty}
      >
        Cancel
      </button>
      <button
        type="button"
        className="ms-btn ms-btn-primary"
        onClick={save}
        disabled={saving || !isDirty}
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );

  return (
    <div>
      {toast && (
        <div
          className={`ms-toast ${toast.kind === "success" ? "ms-toast-success" : "ms-toast-error"}`}
        >
          {toast.text}
        </div>
      )}
      {saveBar}

      <section className="ms-section">
        <div className="ms-section-header">
          <svg className="ms-section-caret ms-section-caret-open" aria-hidden="true">
            <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#chevronright" />
          </svg>
          Details
        </div>
        {DETAILS_FIELDS.map(renderRow)}
      </section>

      <section className="ms-section">
        <div className="ms-section-header">
          <svg className="ms-section-caret ms-section-caret-open" aria-hidden="true">
            <use xlinkHref="/slds/icons/utility-sprite/svg/symbols.svg#chevronright" />
          </svg>
          Address
        </div>
        {ADDRESS_FIELDS.map(renderRow)}
      </section>

      {saveBar}
    </div>
  );
}
