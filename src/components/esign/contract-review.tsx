"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./packet-wizard.module.css";
const accountFields = [
  ["name", "Account Name"],
  ["ein", "EIN Number / Tax ID"],
  ["billingStreet", "Billing Street"],
  ["billingCity", "Billing City"],
  ["billingState", "Billing State/Province"],
  ["billingCountry", "Billing Country"],
  ["billingZip", "Billing Zip/Postal Code"],
  ["bankName", "Bank Name"],
  ["bankRoutingNumber", "Bank Routing Number"],
  ["bankAccountNumber", "Bank Account Number"],
  ["bankAccountType", "Bank Account Type"],
];
export function ContractReview({
  opportunityId,
  onContinue,
}: {
  opportunityId: string;
  onContinue: (name: string, email: string, options: { includeAddendum: boolean; documents: { name: string; available: boolean }[] }) => void;
}) {
  const [data, setData] = useState<{
    account: Record<string, string>;
    contact: Record<string, string>;
    ssn: string;
    totalDebt: number;
    legalNetwork: string;
    processor: string;
    includeAddendum: boolean;
    documents: { name: string; available: boolean }[];
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/esign/review/${opportunityId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [opportunityId]);
  async function save() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/esign/review/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          contact: {
            ...data.contact,
            birthdate: data.contact.birthdate || undefined,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onContinue(d.signerName, d.signerEmail, { includeAddendum: data.includeAddendum, documents: data.documents });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={`${styles.wizard} ${styles.reviewDialog}`}
      aria-labelledby="contract-review-title"
      onCancel={(event) => {
        event.preventDefault();
        window.location.assign(`/opportunities/${opportunityId}`);
      }}
    >
      <header className={styles.reviewHeader}>
        <h1 id="contract-review-title">Review the following Details</h1>
        <a href={`/opportunities/${opportunityId}`} aria-label="Close contract review">×</a>
      </header>
      {!data ? (
        <div className={styles.reviewScroll}>{error ? <p role="alert" className={styles.error}>{error}</p> : <p>Loading contract details…</p>}</div>
      ) : (
        <form className={styles.reviewForm}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className={styles.reviewScroll}>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.reviewGrid}>
            {accountFields.map(([key, label]) => (
              <label key={key}>
                <span className={styles.required}>*</span> {label}
                {key === "bankAccountType" ? (
                  <select
                    required
                    value={data.account[key]}
                    onChange={(e) =>
                      setData({
                        ...data,
                        account: { ...data.account, [key]: e.target.value },
                      })
                    }
                  >
                    <option value="">Select</option>
                    <option>Checking</option>
                    <option>Savings</option>
                  </select>
                ) : (
                  <input
                    required
                    value={data.account[key]}
                    onChange={(e) =>
                      setData({
                        ...data,
                        account: { ...data.account, [key]: e.target.value },
                      })
                    }
                  />
                )}
              </label>
            ))}
            <label className={styles.reviewRowStart}>
              SSN
              <input disabled value={data.ssn} />
            </label>
            <div />
            <div />
            {[
              ["firstName", "First Name"],
              ["lastName", "Last Name"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["birthdate", "Birthdate"],
            ].map(([key, label]) => (
              <label key={key}>
                <span className={styles.required}>*</span> {label}
                <input
                  required={key !== "birthdate"}
                  type={
                    key === "birthdate"
                      ? "date"
                      : key === "email"
                        ? "email"
                        : "text"
                  }
                  value={data.contact[key]}
                  onChange={(e) =>
                    setData({
                      ...data,
                      contact: { ...data.contact, [key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
            <label>
              Legal Network
              <input disabled value={data.legalNetwork} />
            </label>
            <label>
              Legal Network Assignment Reason
              <input disabled value="Based on creditors" />
            </label>
            <label>
              Payment Processor
              <input disabled value={data.processor} />
            </label>
            <label>
              Current Total Debt
              <input
                disabled
                value={data.totalDebt.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              />
            </label>
          </div>
          </div>
          <footer className={styles.reviewFooter}>
            <a href={`/opportunities/${opportunityId}`}>Close</a>
            <button className={styles.primary} disabled={busy}>
              {busy ? "Saving…" : "Update and Prepare Contract"}
            </button>
          </footer>
        </form>
      )}
    </dialog>
  );
}
