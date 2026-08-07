"use client";

import { useState } from "react";
import { US_STATES, isValidUsZip } from "@/lib/us-states";
import { KNOWN_CREDITORS } from "@/lib/creditors";

/**
 * Public no-login intake form. The agent picks which sections to request
 * (address, ssn, ein, dob, debts) when sending the link; only those render.
 */

export type IntakeFieldKey = "address" | "ssn" | "ein" | "dob" | "debts";

type Fields = {
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
};

type DebtRow = { lender: string; lenderOther: string; amount: string };

const OTHER = "__OTHER__";
const LENDER_OPTIONS = [...KNOWN_CREDITORS].sort((a, b) => a.localeCompare(b));

function formatSsn(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function formatEin(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 9);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}-${d.slice(2)}`;
}

export function PublicIntakeForm({
  token,
  initial,
  requested,
}: {
  token: string;
  initial: Fields;
  requested: IntakeFieldKey[];
}) {
  const want = (k: IntakeFieldKey) => requested.includes(k);
  const [f, setF] = useState<Fields & { notes: string }>({ ...initial, notes: "" });
  const [ssn, setSsn] = useState("");
  const [ein, setEin] = useState("");
  const [dob, setDob] = useState("");
  const [debts, setDebts] = useState<DebtRow[]>([{ lender: "", lenderOther: "", amount: "" }]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const setDebt = (i: number, k: keyof DebtRow) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDebts((rows) => rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));
  const effectiveLender = (d: DebtRow) => (d.lender === OTHER ? d.lenderOther.trim() : d.lender);

  async function submit() {
    if (want("address") && f.zip.trim() && !isValidUsZip(f.zip)) {
      setError("Please enter a valid US ZIP code (e.g. 33309).");
      return;
    }
    if (want("ssn") && ssn && ssn.replace(/\D/g, "").length !== 9) {
      setError("Please enter your full 9-digit Social Security Number.");
      return;
    }
    if (want("ein") && ein && ein.replace(/\D/g, "").length !== 9) {
      setError("Please enter your full 9-digit EIN / Tax ID.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          ssn: want("ssn") ? ssn : "",
          ein: want("ein") ? ein : "",
          dob: want("dob") ? dob : "",
          debts: want("debts")
            ? debts
                .map((d) => ({ lender: effectiveLender(d), amount: d.amount }))
                .filter((d) => d.lender || d.amount.trim())
            : [],
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error === "expired" ? "This link has expired." : "Could not submit, please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error, please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div
        style={{
          padding: "14px 16px",
          background: "#eaf5ec",
          border: "1px solid #b7e1c2",
          borderRadius: 6,
          fontSize: 14,
          color: "#2e844a",
          fontWeight: 600,
        }}
      >
        Thank you. Your information has been received.
      </div>
    );
  }

  return (
    <div>
      {want("address") && (
        <section>
          <h2 style={sectionTitle}>Mailing address</h2>
          <label style={lbl}>Street address</label>
          <input value={f.street} onChange={set("street")} style={inp} placeholder="123 Main St" />

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>City</label>
              <input value={f.city} onChange={set("city")} style={inp} />
            </div>
            <div>
              <label style={lbl}>State</label>
              <select value={f.state} onChange={set("state")} style={{ ...inp, background: "#fff" }}>
                <option value="">Select…</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>ZIP</label>
              <input value={f.zip} onChange={set("zip")} style={inp} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={lbl}>Phone</label>
              <input value={f.phone} onChange={set("phone")} style={inp} type="tel" />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input value={f.email} onChange={set("email")} style={inp} type="email" />
            </div>
          </div>
        </section>
      )}

      {(want("ssn") || want("ein") || want("dob")) && (
        <section>
          <h2 style={sectionTitle}>Identity details</h2>
          <div style={{ display: "grid", gridTemplateColumns: want("ssn") && want("ein") ? "1fr 1fr" : "1fr", gap: 10 }}>
            {want("ssn") && (
              <div>
                <label style={lbl}>Social Security Number</label>
                <input
                  value={ssn}
                  onChange={(e) => setSsn(formatSsn(e.target.value))}
                  style={inp}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="123-45-6789"
                />
              </div>
            )}
            {want("ein") && (
              <div>
                <label style={lbl}>Business EIN / Tax ID</label>
                <input
                  value={ein}
                  onChange={(e) => setEin(formatEin(e.target.value))}
                  style={inp}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="12-3456789"
                />
              </div>
            )}
          </div>
          {want("dob") && (
            <div>
              <label style={lbl}>Date of birth</label>
              <input value={dob} onChange={(e) => setDob(e.target.value)} style={inp} type="date" />
            </div>
          )}
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#747474" }}>
            This information is transmitted securely and used only to process your file.
          </p>
        </section>
      )}

      {want("debts") && (
        <section>
          <h2 style={sectionTitle}>Your current debts</h2>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#444444" }}>
            List each lender or funder you currently owe, with the approximate balance.
          </p>
          {debts.map((d, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 32px", gap: 10, alignItems: "end" }}>
              <div>
                <label style={lbl}>Lender / funder name</label>
                <select value={d.lender} onChange={setDebt(i, "lender")} style={{ ...inp, background: "#fff" }}>
                  <option value="">Select your lender…</option>
                  {LENDER_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                  <option value={OTHER}>Other (not on the list)</option>
                </select>
                {d.lender === OTHER && (
                  <input
                    value={d.lenderOther}
                    onChange={setDebt(i, "lenderOther")}
                    style={{ ...inp, marginTop: 8 }}
                    placeholder="Type the lender's name"
                  />
                )}
              </div>
              <div>
                <label style={lbl}>Amount owed</label>
                <input
                  value={d.amount}
                  onChange={setDebt(i, "amount")}
                  style={inp}
                  inputMode="decimal"
                  placeholder="$25,000"
                />
              </div>
              <button
                type="button"
                aria-label="Remove debt"
                onClick={() => setDebts((rows) => (rows.length > 1 ? rows.filter((_, j) => j !== i) : rows))}
                style={{
                  height: 38,
                  border: "1px solid #c9c7c5",
                  background: "#fff",
                  borderRadius: 4,
                  cursor: "pointer",
                  color: "#747474",
                  fontSize: 16,
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDebts((rows) => [...rows, { lender: "", lenderOther: "", amount: "" }])}
            style={{
              marginTop: 10,
              background: "#fff",
              border: "1px solid #3052FF",
              color: "#3052FF",
              padding: "8px 14px",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add another debt
          </button>
        </section>
      )}

      <label style={lbl}>Anything else we should know?</label>
      <textarea
        value={f.notes}
        onChange={set("notes")}
        rows={4}
        style={{ ...inp, height: "auto", padding: 8, resize: "vertical" }}
        placeholder="Optional"
      />

      {error && (
        <div style={{ margin: "4px 0 12px", fontSize: 13, color: "#c23934" }}>{error}</div>
      )}

      <button
        onClick={submit}
        disabled={busy}
        style={{
          marginTop: 8,
          width: "100%",
          background: "#3052FF",
          border: "none",
          padding: "12px",
          borderRadius: 6,
          fontSize: 15,
          fontWeight: 600,
          color: "#fff",
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Submitting..." : "Submit my information"}
      </button>
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  margin: "20px 0 4px",
  paddingBottom: 6,
  borderBottom: "1px solid #ecebea",
  fontSize: 15,
  fontWeight: 700,
  color: "#181818",
};
const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#444444",
  margin: "12px 0 4px",
};
const inp: React.CSSProperties = {
  width: "100%",
  height: 38,
  padding: "0 10px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 14,
  boxSizing: "border-box",
};
