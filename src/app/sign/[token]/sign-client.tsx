"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState, useRef } from "react";
import { DocumentViewer } from "@/components/esign/document-viewer";
import { AdoptModal, DeclineModal } from "@/components/esign/adopt-signature";
import { DISCLOSURE_TEXT, DISCLOSURE_VERSION } from "@/lib/esign/disclosure";
import {
  orderedFields,
  textFieldError,
  nextUnfinished,
  type FieldGroups,
  type SigningField,
} from "@/lib/esign/fields";
import styles from "@/components/esign/signing.module.css";
type Props = FieldGroups & {
  token: string;
  envelopeId: string;
  signerName: string;
  signerEmail: string;
  documentName: string;
  templateName: string;
  senderName?: string;
  message?: string;
  documents?: { name: string; startPage: number; pageCount: number }[];
  previewUrl?: string;
};
export function SignClient(props: Props) {
  const { token, signerName, signerEmail, documentName, previewUrl } = props;
  const base = `/api/esign/envelopes/by-token/${token}`;
  const fields = useMemo(() => orderedFields(props), [props]);
  const [step, setStep] = useState<
    "welcome" | "verify" | "review" | "done" | "declined"
  >("welcome");
  const [verified, setVerified] = useState(!!previewUrl);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState(signerName);
  const [signature, setSignature] = useState<string | null>(null);
  const [initial, setInitial] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string | null>(null);
  const [adopt, setAdopt] = useState<SigningField | null>(null);
  const [menu, setMenu] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  const [finishingConsent, setFinishingConsent] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step !== "review") return;
    const viewport = window.visualViewport;
    const resize = () => {
      if (
        window.matchMedia("(max-width: 700px)").matches &&
        viewport &&
        viewport.scale === 1
      ) {
        shellRef.current?.style.setProperty(
          "--signing-height",
          `${viewport.height}px`,
        );
        if (shellRef.current)
          shellRef.current.dataset.keyboardOpen = String(
            window.innerHeight - viewport.height > 120,
          );
      } else {
        shellRef.current?.style.removeProperty("--signing-height");
        if (shellRef.current) delete shellRef.current.dataset.keyboardOpen;
      }
    };
    resize();
    viewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, [step]);
  const activeField = fields.find((f) => f.id === active);
  const today = new Date().toISOString().slice(0, 10);
  const completed = new Set(
    fields
      .filter((f) =>
        f.kind === "name"
          ? !!fullName.trim()
          : f.kind === "date"
            ? true
            : f.kind === "text"
              ? !!values[String(f.index)]?.trim() &&
                !textFieldError(f, values[String(f.index)] ?? "")
              : f.kind === "checkbox"
                ? f.required !== true || !!checks[String(f.index)]
                : !!applied[f.id],
      )
      .map((f) => f.id),
  );
  const required = fields
    .filter((f) => f.kind !== "checkbox" || f.required === true)
    .filter((f) => f.required !== false);
  const remaining = required.filter((f) => !completed.has(f.id));
  useEffect(() => {
    if (previewUrl) return;
    fetch(`${base}/verify`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setVerified(d.verified === true))
      .catch(() => {});
  }, [base, previewUrl]);
  async function verify(action: "send" | "verify" | "link") {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${base}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Verification failed");
      if (d.sent) setCodeSent(true);
      if (d.verified) {
        setVerified(true);
        setStep("review");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }
  function changeName(name: string) {
    setFullName(name);
    setSignature(null);
    setInitial(null);
    setApplied({});
  }
  function next() {
    const f =
      nextUnfinished(fields, completed, active ?? undefined) ?? remaining[0];
    if (f) setActive(f.id);
    else setActive(null);
  }
  function apply(f: SigningField) {
    setActive(f.id);
    if (
      (f.kind === "signature" && !signature) ||
      (f.kind === "initial" && !initial)
    ) {
      setAdopt(f);
      return;
    }
    setApplied((v) => ({ ...v, [f.id]: true }));
  }
  function requestFinish() {
    if (remaining.length) { next(); return; }
    if (!consent) { setFinishingConsent(true); setShowConsent(true); return; }
    void finish();
  }
  async function finish() {
    if (remaining.length || !loaded || !consent || !signature) {
      setError(
        "Complete the required fields and accept the signing disclosure.",
      );
      return;
    }
    if (previewUrl) {
      setStep("done");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const textValues = Object.fromEntries(
        fields
          .filter((f) => f.kind === "text" || f.kind === "name")
          .map((f) => [
            String(f.index),
            f.kind === "name" ? fullName : (values[String(f.index)] ?? ""),
          ]),
      );
      const r = await fetch(`${base}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          ...(initial ? { initial } : {}),
          fullName,
          consent,
          disclosureVersion: DISCLOSURE_VERSION,
          textValues,
          dateValues: Object.fromEntries(
            props.dateBoxes.map((_, i) => [String(i), today]),
          ),
          checkboxValues: checks,
          appliedFieldIds: Object.keys(applied).filter((k) => applied[k]),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Signing failed");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signing failed");
    } finally {
      setBusy(false);
    }
  }
  async function decline() {
    if (previewUrl) {
      setStep("declined");
      setDeclining(false);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${base}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!r.ok) throw new Error("Unable to decline. Please try again.");
      setDeclining(false);
      setStep("declined");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const logo = (
    <img
      className={styles.logo}
      src="/brand/coastal-debt-logo.svg"
      alt="Coastal Debt Resolve"
    />
  );
  const declineDialog = declining && (
    <DeclineModal
      reason={reason}
      setReason={setReason}
      onCancel={() => setDeclining(false)}
      onConfirm={decline}
    />
  );
  if (step === "done" || step === "declined")
    return (
      <div className={styles.welcome}>
        <div className={`${styles.welcomeCard} ${styles.success}`}>
          {logo}
          <div className={styles.successIcon} aria-hidden="true">
            {step === "done" ? "✓" : "—"}
          </div>
          <div className={styles.completionEyebrow}>Coastal Sign</div>
          <h1>
            {step === "done" ? "You’re finished signing!" : "Document declined"}
          </h1>
          <p>
            {step === "done"
              ? "Your completed document and signing record are ready to download."
              : "The sender can follow up with you about another way to complete this document."}
          </p>
          {step === "done" && (
            <div className={styles.completedDocument}>
              <span>Signed document</span>
              <strong>{documentName}</strong>
            </div>
          )}
          {previewUrl ? (
            <p>Preview only. No agreement was signed or sent.</p>
          ) : (
            step === "done" && (
              <div className={styles.successActions}>
                <a
                  className={styles.primary}
                  href={`${base}/signed-pdf`}
                  target="_blank"
                  rel="noopener"
                >
                  Download signed copy
                </a>
                <a className={styles.successRecord} href={`${base}/evidence`}>
                  Download signing record
                </a>
              </div>
            )
          )}
        </div>
      </div>
    );
  if (step === "welcome" || step === "verify")
    return (
      <div className={styles.welcome}>
        <div className={styles.welcomeCard}>
          {logo}
          <h1>
            {step === "welcome" ? "Review and continue" : "Verify your email"}
          </h1>
          <strong>
            Message from {props.senderName ?? "Coastal Debt Resolve"}
          </strong>
          <p>
            {props.message ??
              "I am sending you this request for your electronic signature. Please review and electronically sign the documents."}
          </p>
          {step === "verify" && (
            <>
              <p>
                We’ll send a verification code to <strong>{signerEmail}</strong>
                .
              </p>
              <button
                className={styles.button}
                disabled={busy}
                onClick={() => verify("send")}
              >
                {codeSent ? "Send another code" : "Send verification code"}
              </button>
              {codeSent && (
                <div className={styles.emailCode}>
                  <input
                    aria-label="Verification code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    value={code}
                    maxLength={6}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <button
                    className={styles.primary}
                    disabled={busy || code.length !== 6}
                    onClick={() => verify("verify")}
                  >
                    Verify and continue
                  </button>
                </div>
              )}
            </>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.welcomeActions}>
            <select aria-label="Language" defaultValue="en-US">
              <option value="en-US">English (US)</option>
            </select>
            <div>
              <details className={styles.otherOptions}>
                <summary>
                  Other Options <span aria-hidden="true">⌄</span>
                </summary>
                <div className={styles.otherOptionsMenu}>
                  <p>
                    You can finish later by reopening the link in your email.
                  </p>
                  <button
                    className={styles.declineLink}
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open");
                      setDeclining(true);
                    }}
                  >
                    Decline to sign
                  </button>
                </div>
              </details>
              {step === "welcome" && (
                <button
                  className={styles.primary}
                  disabled={busy}
                  onClick={() =>
                    verified ? setStep("review") : void verify("link")
                  }
                >
                  {busy ? "Opening…" : "Continue"}
                </button>
              )}
            </div>
          </div>
          {previewUrl && (
            <p className={styles.notice}>
              Interactive preview — no email or signature will be submitted.
            </p>
          )}
        </div>
        {declineDialog}
      </div>
    );
  function field(f: SigningField) {
    if (f.kind === "signature" || f.kind === "initial") {
      const image = f.kind === "signature" ? signature : initial;
      return (
        <button
          aria-label={`${applied[f.id] ? "Signed" : "Sign"}: ${f.label ?? f.kind}, page ${f.page}`}
          onClick={() => apply(f)}
          className={applied[f.id] ? styles.signed : ""}
        >
          {applied[f.id] && image ? (
            <img src={image} alt={f.kind} />
          ) : f.kind === "signature" ? (
            "✎ Sign"
          ) : (
            "✎ Initial"
          )}
        </button>
      );
    }
    if (f.kind === "name")
      return (
        <span className={styles.autoField} title={fullName}>
          {fullName}
        </span>
      );
    if (f.kind === "date")
      return <span className={styles.autoField}>{today}</span>;
    if (f.kind === "checkbox")
      return (
        <input
          aria-label={f.label ?? "Checkbox"}
          type="checkbox"
          checked={!!checks[String(f.index)]}
          onFocus={() => setActive(f.id)}
          onChange={(e) =>
            setChecks((v) => ({ ...v, [String(f.index)]: e.target.checked }))
          }
        />
      );
    if (f.inputType === "dropdown")
      return (
        <select
          aria-label={f.label ?? "Select an option"}
          value={values[String(f.index)] ?? ""}
          onFocus={() => setActive(f.id)}
          onChange={(e) =>
            setValues((v) => ({ ...v, [String(f.index)]: e.target.value }))
          }
        >
          <option value="">Select…</option>
          {f.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    if (f.inputType === "radio")
      return (
        <div
          role="radiogroup"
          aria-label={f.label ?? "Choose an option"}
          style={{
            background: "#fff6cc",
            height: "100%",
            overflow: "auto",
            fontSize: 11,
          }}
        >
          {f.options?.map((o) => (
            <label
              key={o}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <input
                style={{ width: 14, height: 14 }}
                type="radio"
                name={f.id}
                checked={values[String(f.index)] === o}
                onChange={() =>
                  setValues((v) => ({ ...v, [String(f.index)]: o }))
                }
              />
              {o}
            </label>
          ))}
        </div>
      );
    return (
      <input
        type={
          f.inputType === "email"
            ? "email"
            : f.inputType === "number"
              ? "number"
              : "text"
        }
        aria-invalid={!!textFieldError(f, values[String(f.index)] ?? "")}
        aria-label={f.label ?? "Required text"}
        maxLength={500}
        placeholder={f.label ?? "Required"}
        value={values[String(f.index)] ?? ""}
        onFocus={() => setActive(f.id)}
        onChange={(e) =>
          setValues((v) => ({ ...v, [String(f.index)]: e.target.value }))
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") next();
        }}
      />
    );
  }
  function documentField(f: SigningField) {
    if (f.kind === "name" || f.kind === "date") return field(f);
    const label =
      f.kind === "signature"
        ? "Sign"
        : f.kind === "initial"
          ? "Initial"
          : f.kind === "checkbox"
            ? "Check"
            : "Fill";
    const appliedImage = applied[f.id]
      ? f.kind === "signature"
        ? signature
        : f.kind === "initial"
          ? initial
          : null
      : null;
    return (
      <>
        <div className={styles.desktopField}>{field(f)}</div>
        <button
          type="button"
          className={styles.mobileMarker}
          aria-label={`${f.label ?? label}, page ${f.page}. Open field editor`}
          onClick={() => setActive(f.id)}
        >
          {appliedImage ? (
            <img src={appliedImage} alt={f.kind} />
          ) : f.kind === "text" && values[String(f.index)] ? (
            values[String(f.index)]
          ) : completed.has(f.id) ? (
            "✓"
          ) : (
            label
          )}
        </button>
      </>
    );
  }
  return (
    <div className={styles.shell} ref={shellRef}>
      <header className={`${styles.header} ${styles.reviewHeader}`}>
        <div className={styles.heading}>Review and complete</div>
        <button className={styles.headerFinish} disabled={!loaded || busy} onClick={requestFinish}>Finish</button>
        <div className={styles.menu}>
          <button className={styles.button} onClick={() => setMenu((v) => !v)}>
            Other options ▾
          </button>
          {menu && (
            <div className={styles.menuList}>
              <button
                onClick={() => {
                  setFinishingConsent(false);
                  setShowConsent(true);
                  setMenu(false);
                }}
              >
                Signing disclosure
              </button>
              <button
                onClick={() => {
                  setDeclining(true);
                  setMenu(false);
                }}
              >
                Decline to sign
              </button>
              <a
                href={previewUrl ?? `${base}/pdf`}
                target="_blank"
                rel="noopener"
              >
                Download documents
              </a>
            </div>
          )}
        </div>
      </header>
      <DocumentViewer
        url={previewUrl ?? `${base}/pdf`}
        envelopeId={props.envelopeId}
        onStart={loaded ? next : undefined}
        fields={fields}
        activeId={active}
        renderField={documentField}
        onReady={() => setLoaded(true)}
        onError={setError}
        documents={props.documents}
      />
      {activeField &&
        activeField.kind !== "date" &&
        activeField.kind !== "name" && (
          <section
            className={styles.mobileFieldEditor}
            aria-label="Current signing field"
          >
            <div className={styles.mobileFieldHeading}>
              <strong>
                {activeField.label ??
                  (activeField.kind === "signature"
                    ? "Your signature"
                    : activeField.kind === "initial"
                      ? "Your initials"
                      : "Complete this field")}
              </strong>
              <span>Page {activeField.page}</span>
            </div>
            <div
              key={activeField.id}
              id={`mobile-${activeField.id}`}
              className={styles.mobileFieldControl}
            >
              {field(activeField)}
            </div>
            {activeField.kind === "text" &&
              textFieldError(
                activeField,
                values[String(activeField.index)] ?? "",
              ) && (
                <p role="alert">
                  {textFieldError(
                    activeField,
                    values[String(activeField.index)] ?? "",
                  )}
                </p>
              )}
          </section>
        )}
      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}
      <footer className={styles.footer}>
        <div className={styles.progress} aria-live="polite">
          {remaining.length
            ? `${remaining.length} required fields remaining`
            : "All required fields completed"}
          <progress
            max={Math.max(1, required.length)}
            value={required.length - remaining.length}
          />
        </div>
        {remaining.length ? (
          <button className={styles.primary} disabled={!loaded} onClick={next}>
            {active ? "Next" : "Start"}
          </button>
        ) : (
          <button
            className={styles.primary}
            disabled={!loaded || busy}
            onClick={requestFinish}
          >
            {busy ? "Finishing…" : "Finish & Sign"}
          </button>
        )}
      </footer>
      {adopt && (
        <AdoptModal
          envelopeId={props.envelopeId}
          kind={adopt.kind === "initial" ? "initial" : "signature"}
          fullName={fullName}
          setFullName={changeName}
          onCancel={() => setAdopt(null)}
          onAdopt={(image) => {
            if (adopt.kind === "initial") setInitial(image);
            else setSignature(image);
            setApplied((v) => ({ ...v, [adopt.id]: true }));
            setAdopt(null);
          }}
        />
      )}
      {showConsent && (
        <div className={styles.modalBackdrop}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="signing-consent-title"
            className={`${styles.modal} ${styles.consentModal}`}
          >
            <h2 id="signing-consent-title">
              Electronic records and signature disclosure
            </h2>
            <div className={styles.consentBody}>
              <p>{DISCLOSURE_TEXT}</p>
              <label className={styles.consent}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I have reviewed the document, can retain a copy, and agree to
                  the disclosure above.
                </span>
              </label>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.button}
                onClick={() => setShowConsent(false)}
              >
                Back to document
              </button>
              <button
                className={styles.primary}
                disabled={finishingConsent && (!consent || busy)}
                onClick={() => { setShowConsent(false); if(finishingConsent) void finish(); }}
              >
                {finishingConsent ? "Agree & Finish Signing" : "Continue"}
              </button>
            </div>
          </section>
        </div>
      )}
      {declineDialog}
    </div>
  );
}
