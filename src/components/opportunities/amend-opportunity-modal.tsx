"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AmendmentView } from "@/lib/opportunity-amendment";
import { PAYMENT_STATUSES } from "@/lib/debt-payment-status";

type View = AmendmentView & {
  canEditPayments: boolean;
  hasActivePlan: boolean;
};
type Debt = Omit<View["debts"][number], "id"> & { id?: string };
export function AmendOpportunityModal({
  opportunityId,
  onClose,
}: {
  opportunityId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<View["payments"]>([]);
  const [term, setTerm] = useState(6);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/opportunities/${opportunityId}/amend`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not load amendment");
        if (active) {
          setView(d);
          setDebts(d.debts);
          setPayments(d.payments);
          setTerm(d.termMonths);
          setDate(d.firstPaymentDate);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [opportunityId]);
  function editDebt(index: number, patch: Partial<Debt>) {
    setDebts((rows) =>
      rows.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!view) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/opportunities/${opportunityId}/amend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision: view.revision,
            reason,
            termMonths: term,
            firstPaymentDate: date,
            debts: debts.map(({ locked: _locked, ...d }) => d),
            payments: payments.map(({ id, amount, date }) => ({
              id,
              amount,
              date,
            })),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not save amendment");
      toast.success(`Amendment ${data.version} saved`);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save amendment");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="slds-modal slds-fade-in-open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="amend-title"
      style={{ background: "rgba(0,0,0,.4)", zIndex: 1000 }}
    >
      <form
        className="slds-modal__container"
        style={{ width: "95%", maxWidth: 1200 }}
        onSubmit={save}
      >
        <header className="slds-modal__header">
          <h2 id="amend-title" className="slds-text-heading_medium">
            Amend Opportunity{view ? ` · Version ${view.version}` : ""}
          </h2>
          <p>
            Review debt balances and upcoming payments, then save a version with
            the reason for the change.
          </p>
        </header>
        <div
          className="slds-modal__content slds-p-around_medium"
          style={{ overflowY: "auto" }}
        >
          {error && (
            <p role="alert" style={{ color: "#ba0517", marginBottom: 14 }}>
              {error}
            </p>
          )}
          {!view ? (
            <p>
              {error
                ? "Close this window and try again."
                : "Loading opportunity…"}
            </p>
          ) : (
            <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
              <label>
                Reason for amendment
                <textarea
                  className="slds-textarea"
                  required
                  minLength={3}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <h3
                className="slds-text-heading_small"
                style={{ margin: "18px 0 10px" }}
              >
                Debts
              </h3>
              <div style={{ overflowX: "auto" }}>
                <table className="slds-table slds-table_cell-buffer slds-table_bordered">
                  <thead>
                    <tr>
                      {[
                        "Lender",
                        "Debt amount",
                        "Current balance",
                        "Enrolled balance",
                        "Payment",
                        "Frequency",
                        "Debt status",
                        "",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {debts.map((d, i) => (
                      <tr key={d.id ?? `new-${i}`}>
                        <td>
                          <input
                            aria-label={`Lender ${i + 1}`}
                            className="slds-input"
                            disabled={d.locked}
                            required
                            value={d.creditorName}
                            onChange={(e) =>
                              editDebt(i, { creditorName: e.target.value })
                            }
                          />
                          {d.locked && <small>Finalized debt</small>}
                        </td>
                        {(
                          [
                            "originalBalance",
                            "currentBalance",
                            "enrolledBalance",
                            "paymentAmount",
                          ] as const
                        ).map((k) => (
                          <td key={k}>
                            <input
                              aria-label={`${k} ${i + 1}`}
                              className="slds-input"
                              style={{ minWidth: 100 }}
                              type="number"
                              min={k === "originalBalance" ? ".01" : "0"}
                              step=".01"
                              required={k !== "paymentAmount"}
                              disabled={d.locked}
                              value={d[k] ?? ""}
                              onChange={(e) =>
                                editDebt(i, {
                                  [k]:
                                    e.target.value === "" &&
                                    k === "paymentAmount"
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                            />
                          </td>
                        ))}
                        <td>
                          <select
                            aria-label={`Frequency ${i + 1}`}
                            className="slds-select"
                            disabled={d.locked}
                            value={d.paymentFrequency}
                            onChange={(e) =>
                              editDebt(i, { paymentFrequency: e.target.value })
                            }
                          >
                            <option value="">Select…</option>
                            {[
                              ...new Set([
                                "DAILY",
                                "WEEKLY",
                                "MONTHLY",
                                ...(d.paymentFrequency
                                  ? [d.paymentFrequency]
                                  : []),
                              ]),
                            ].map((f) => (
                              <option key={f} value={f}>
                                {f.replaceAll("_", " ").toLowerCase()}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            aria-label={`Debt status ${i + 1}`}
                            className="slds-select"
                            disabled={d.locked}
                            required={!d.id}
                            value={d.paymentStatus}
                            onChange={(e) =>
                              editDebt(i, { paymentStatus: e.target.value })
                            }
                          >
                            <option value="">Select…</option>
                            {[
                              ...new Set([
                                ...PAYMENT_STATUSES,
                                ...(d.paymentStatus ? [d.paymentStatus] : []),
                              ]),
                            ].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {!d.id && (
                            <button
                              type="button"
                              className="slds-button"
                              onClick={() =>
                                setDebts((rows) =>
                                  rows.filter((_, ix) => ix !== i),
                                )
                              }
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="slds-button"
                style={{ marginTop: 10 }}
                onClick={() =>
                  setDebts((rows) => [
                    ...rows,
                    {
                      creditorName: "",
                      originalBalance: 0,
                      currentBalance: 0,
                      enrolledBalance: 0,
                      paymentAmount: null,
                      paymentFrequency: "WEEKLY",
                      paymentStatus: "",
                      locked: false,
                    },
                  ])
                }
              >
                + Add debt
              </button>
              <div style={{ display: "flex", gap: 18, marginTop: 18 }}>
                <label>
                  Payment term (months)
                  <input
                    className="slds-input"
                    type="number"
                    min={1}
                    max={30}
                    required
                    disabled={view.hasActivePlan && !view.canEditPayments}
                    value={term}
                    onChange={(e) => setTerm(Number(e.target.value))}
                  />
                </label>
                <label>
                  First payment date
                  <input
                    className="slds-input"
                    type="date"
                    required
                    disabled={view.hasActivePlan}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              </div>
              {!!payments.length && (
                <>
                  <h3
                    className="slds-text-heading_small"
                    style={{ marginTop: 20 }}
                  >
                    Upcoming payments
                  </h3>
                  <p>
                    Adjust the dates and amounts below. Completed payments
                    retain their original values.
                  </p>
                  <table
                    className="slds-table slds-table_cell-buffer slds-table_bordered"
                    style={{ marginTop: 10 }}
                  >
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Allocated fees</th>
                        <th>Escrow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p, i) => (
                        <tr key={p.id}>
                          <td>
                            <input
                              aria-label={`Payment date ${i + 1}`}
                              className="slds-input"
                              disabled={!view.canEditPayments}
                              type="date"
                              required
                              value={p.date}
                              onChange={(e) =>
                                setPayments((rows) =>
                                  rows.map((d) =>
                                    d.id === p.id
                                      ? { ...d, date: e.target.value }
                                      : d,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`Payment amount ${i + 1}`}
                              className="slds-input"
                              disabled={!view.canEditPayments}
                              type="number"
                              min={Math.max(0.01, p.fees)}
                              step=".01"
                              required
                              value={p.amount}
                              onChange={(e) =>
                                setPayments((rows) =>
                                  rows.map((d) =>
                                    d.id === p.id
                                      ? { ...d, amount: Number(e.target.value) }
                                      : d,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td>${p.fees.toFixed(2)}</td>
                          <td>${(p.amount - p.fees).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </fieldset>
          )}
        </div>
        <footer className="slds-modal__footer">
          <button
            type="button"
            className="slds-button slds-button_neutral"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="slds-button slds-button_brand"
            disabled={busy || !view}
          >
            {busy ? "Saving…" : "Save amendment"}
          </button>
        </footer>
      </form>
    </div>
  );
}
