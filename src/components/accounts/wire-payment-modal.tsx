"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Plan = {
  id: string;
  status: string;
  startDate: string;
  opportunity: { name: string | null } | null;
};
type Wire = {
  id: string;
  reference: string;
  receivedAt: string;
  grossAmount: number;
  wireFee: number;
  netAmount: number;
};

export function WirePaymentModal({
  accountId,
  onClose,
}: {
  accountId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Wire[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const [form, setForm] = useState({
    programPlanId: "",
    reference: "",
    receivedAt: today,
    grossAmount: "",
    wireFee: "0",
    wireType: "Regular",
    legalFeePaid: false,
    notes: "",
  });
  useEffect(() => {
    let active = true;
    fetch(`/api/accounts/${accountId}/wire-payments`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Unable to load payment plans");
        if (active) {
          setPlans(d.plans);
          setPayments(d.payments);
          if (d.plans.length === 1)
            setForm((f) => ({ ...f, programPlanId: d.plans[0].id }));
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [accountId]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/accounts/${accountId}/wire-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          requestKey,
          grossAmount: Number(form.grossAmount),
          wireFee: Number(form.wireFee),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Unable to record payment");
      toast.success("Wire payment recorded");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to record payment");
    } finally {
      setBusy(false);
    }
  }
  const input = "slds-input";
  const amount = Number(form.grossAmount) - Number(form.wireFee);
  return (
    <div
      className="slds-modal slds-fade-in-open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wire-title"
      style={{ background: "rgba(0,0,0,.4)", zIndex: 1000 }}
    >
      <form
        className="slds-modal__container"
        style={{ maxWidth: 780, width: "90%" }}
        onSubmit={save}
      >
        <header className="slds-modal__header">
          <h2 id="wire-title" className="slds-text-heading_medium">
            Log Wire Payment
          </h2>
          <p>Record a wire that has already been received.</p>
        </header>
        <div
          className="slds-modal__content slds-p-around_medium"
          style={{ overflowY: "auto" }}
        >
          {error && (
            <p role="alert" style={{ color: "#ba0517", marginBottom: 12 }}>
              {error}
            </p>
          )}
          {loading ? (
            <p>Loading payment plans…</p>
          ) : (
            <>
              {!plans.length && (
                <p>
                  No active or paused payment plan is available for this
                  account.
                </p>
              )}
              <fieldset
                disabled={busy || !plans.length}
                style={{ border: 0, padding: 0, margin: 0 }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  }}
                >
                  <label>
                    Program plan
                    <select
                      className="slds-select"
                      required
                      value={form.programPlanId}
                      onChange={(e) =>
                        setForm({ ...form, programPlanId: e.target.value })
                      }
                    >
                      <option value="">Choose a plan</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.opportunity?.name || "Program plan"} ·{" "}
                          {p.startDate.slice(0, 10)} · {p.status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Wire reference
                    <input
                      className={input}
                      required
                      maxLength={120}
                      value={form.reference}
                      onChange={(e) =>
                        setForm({ ...form, reference: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Received date
                    <input
                      className={input}
                      type="date"
                      required
                      max={today}
                      value={form.receivedAt}
                      onChange={(e) =>
                        setForm({ ...form, receivedAt: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Amount received ($)
                    <input
                      className={input}
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={form.grossAmount}
                      onChange={(e) =>
                        setForm({ ...form, grossAmount: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Wire fee ($)
                    <input
                      className={input}
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={form.wireFee}
                      onChange={(e) =>
                        setForm({ ...form, wireFee: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Wire type
                    <select
                      className="slds-select"
                      required
                      value={form.wireType}
                      onChange={(e) =>
                        setForm({ ...form, wireType: e.target.value })
                      }
                    >
                      <option>Regular</option>
                      <option>Settlement</option>
                    </select>
                  </label>
                </div>
                <label style={{ display: "block", marginTop: 14 }}>
                  <input
                    type="checkbox"
                    checked={form.legalFeePaid}
                    onChange={(e) =>
                      setForm({ ...form, legalFeePaid: e.target.checked })
                    }
                  />{" "}
                  Legal fee paid
                </label>
                <label style={{ display: "block", marginTop: 14 }}>
                  Notes
                  <textarea
                    className="slds-textarea"
                    maxLength={4000}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </label>
                <p style={{ marginTop: 12, fontWeight: 600 }}>
                  Net escrow: $
                  {Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}
                </p>
              </fieldset>
              {!!payments.length && (
                <div style={{ marginTop: 22 }}>
                  <h3 className="slds-text-heading_small">
                    Recorded wire payments
                  </h3>
                  <table className="slds-table slds-table_cell-buffer slds-table_bordered">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Received</th>
                        <th>Fee</th>
                        <th>Escrow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td>{p.receivedAt.slice(0, 10)}</td>
                          <td>{p.reference}</td>
                          <td>${p.grossAmount.toFixed(2)}</td>
                          <td>${p.wireFee.toFixed(2)}</td>
                          <td>${p.netAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
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
            disabled={busy || loading || !form.programPlanId}
          >
            {busy ? "Saving…" : "Record wire payment"}
          </button>
        </footer>
      </form>
    </div>
  );
}
