"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import type { PacketConfig, PacketRecipient } from "@/lib/esign/packet-config";
import { PacketStatus } from "./packet-status";
import { ContractReview } from "./contract-review";
import { PacketEditor } from "./packet-editor";
import styles from "./packet-wizard.module.css";
type Template = { id: string; name: string; pageCount: number };
type Item = {
  id: string;
  name: string;
  file?: File;
  templateId?: string;
  selected: boolean;
};
export function PacketWizard({
  opportunityId,
  defaultName = "",
  defaultEmail = "",
  packetId: initialId,
  preview,
}: {
  opportunityId?: string;
  defaultName?: string;
  defaultEmail?: string;
  packetId?: string;
  preview?: { config: PacketConfig; pdfUrl: string };
}) {
  const [includeAddendum, setIncludeAddendum] = useState(false);
  const [requiredAddendum, setRequiredAddendum] = useState(false);
  const [plannedDocuments, setPlannedDocuments] = useState<{ name: string; available: boolean }[]>([]);
  const [reviewed, setReviewed] = useState(!opportunityId || !!initialId);
  const [reviewSigner, setReviewSigner] = useState({
    name: defaultName,
    email: defaultEmail,
  });
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<Item[]>(
    preview?.config.documents.map((d) => ({
      id: d.id,
      name: d.name,
      selected: true,
    })) ?? [],
  );
  const [templates, setTemplates] = useState<Template[]>([]);
  const [chooseTemplates, setChooseTemplates] = useState(false);
  const [id, setId] = useState(initialId ?? "");
  const [revision, setRevision] = useState(1);
  const [config, setConfig] = useState<PacketConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [deliveryFailed, setDeliveryFailed] = useState(false);
  const [status, setStatus] = useState("DRAFT");
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (preview) return;
    fetch("/api/esign/templates")
      .then((r) => r.json())
      .then((d) =>
        setTemplates(
          (d.items ?? []).filter((t: { isActive: boolean }) => t.isActive),
        ),
      )
      .catch(() => {});
    if (initialId)
      fetch(`/api/esign/packets/${initialId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.error) throw new Error(d.error);
          setConfig(d.config);
          setRevision(d.revision);
          setStatus(d.status);
          setStep(d.status === "DRAFT" ? 1 : 3);
          setSent(d.status !== "DRAFT");
          setDeliveryFailed(
            d.envelopes?.some(
              (e: { lastError: string | null }) => !!e.lastError,
            ) ?? false,
          );
        })
        .catch((e) => setError(e.message));
  }, [initialId, preview]);
  function move(index: number, delta: number) {
    setItems((v) => {
      const a = [...v];
      const next = index + delta;
      if (next < 0 || next >= a.length) return a;
      [a[index], a[next]] = [a[next], a[index]];
      return a;
    });
  }
  async function prepare(generate = false, signer = reviewSigner, addendum = includeAddendum) {
    if (config && !generate) {
      setStep(1);
      return;
    }
    if (preview) {
      setConfig(preview.config);
      setId("preview");
      setStep(1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const selected = items.filter((i) => i.selected);
      if (!generate && !selected.length)
        throw new Error("Select at least one document.");
      const form = new FormData();
      if (generate) {
        form.append("generate", "true");
        form.append("includeAddendum", String(addendum));
      }
      for (const item of selected)
        if (item.file) form.append("files", item.file);
      form.append(
        "templateIds",
        JSON.stringify(
          selected.filter((i) => i.templateId).map((i) => i.templateId),
        ),
      );
      form.append(
        "documentOrder",
        JSON.stringify(
          selected.map((i) =>
            i.file
              ? `file:${selected.filter((x) => x.file).indexOf(i)}`
              : `template:${i.templateId}`,
          ),
        ),
      );
      if (opportunityId) form.append("opportunityId", opportunityId);
      const r = await fetch("/api/esign/packets", {
        method: "POST",
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not prepare documents");
      setId(d.id);
      setRevision(d.revision);
      setConfig({
        ...d.config,
        recipients: [
          {
            id: "primary",
            name: signer.name,
            email: signer.email,
            action: "SIGN",
            order: 1,
          },
        ],
      });
      setStep(generate ? 0 : 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preparation failed");
    } finally {
      setBusy(false);
    }
  }
  async function save(next?: number) {
    if (preview) {
      if (next !== undefined) setStep(next);
      return revision;
    }
    if (!config) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/esign/packets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, revision }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not save");
      setRevision(d.revision);
      if (next !== undefined) setStep(next);
      return d.revision as number;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  async function send(retry = false) {
    if (preview) {
      setSent(true);
      setStep(3);
      return;
    }
    const latest = retry ? revision : await save();
    if (latest === undefined) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/esign/packets/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: latest, retry }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 502) {
          setDeliveryFailed(true);
          setStatus("SENT");
          setSent(true);
          setStep(3);
        }
        throw new Error(d.error ?? "Sending failed");
      }
      setDeliveryFailed(false);
      setStatus("SENT");
      setSent(true);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sending failed");
    } finally {
      setBusy(false);
    }
  }
  function recipient(index: number, change: Partial<PacketRecipient>) {
    if (config)
      setConfig({
        ...config,
        recipients: config.recipients.map((r, i) =>
          i === index ? { ...r, ...change } : r,
        ),
      });
  }
  const back = opportunityId ? `/opportunities/${opportunityId}` : "/envelopes";
  if (!reviewed && opportunityId)
    return (
      <ContractReview
        opportunityId={opportunityId}
        onContinue={(name, email, options) => {
          setReviewSigner({ name, email });
          setIncludeAddendum(options.includeAddendum);
          setRequiredAddendum(options.includeAddendum);
          setPlannedDocuments(options.documents);
          setReviewed(true);
          void prepare(true, { name, email }, options.includeAddendum);
        }}
      />
    );
  return (
    <div className={styles.wizard}>
      <header className={styles.header}>
        <img src="/brand/coastal-debt-logo.svg" alt="Coastal Debt" />
        <div>
          <small>Coastal eSign</small>
          <h1>{sent ? "Envelope status" : "Send documents for signature"}</h1>
        </div>
        <a href={back}>Back to record</a>
      </header>
      {!sent && (
        <nav className={styles.steps} aria-label="Sending progress">
          {["Documents", "Recipients", "Prepare & Send"].map((name, i) => (
            <span
              key={name}
              className={
                step === i ? styles.current : step > i ? styles.complete : ""
              }
            >
              {step > i ? "✓ " : ""}
              {name}
            </span>
          ))}
        </nav>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {sent ? (
        <div className={styles.success}>
          {preview ? (
            <p>Preview complete. No email or signing packet was sent.</p>
          ) : (
            <PacketStatus id={id} />
          )}
          {!initialId && !preview && (
            <>
              <h1>
                {status === "COMPLETED"
                  ? "Everyone has signed!"
                  : deliveryFailed
                    ? "Your packet is saved, but delivery needs attention."
                    : "Your envelope was sent!"}
              </h1>
              <div className={styles.successIcon}>
                {deliveryFailed ? "!" : "✉✓"}
              </div>
              <p>
                {status === "COMPLETED"
                  ? "The completed documents are available from the packet record."
                  : "Recipients are invited in the signing order you selected."}
              </p>
            </>
          )}
          {deliveryFailed && (
            <button
              className={styles.primary}
              disabled={busy}
              onClick={() => send(true)}
            >
              Retry delivery
            </button>
          )}
          <p>
            <a href={back}>Back to record</a> ·{" "}
            <a href={`/envelopes/packets/${id}`}>View packet status</a>
          </p>
        </div>
      ) : step === 0 ? (
        <div className={styles.body}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>
                Selected Documents (
                {config?.documents.length ??
                  (items.length ? items.filter((i) => i.selected).length : plannedDocuments.length)}
                )
              </h2>
              <div>
                {opportunityId && (
                  <button
                    disabled={busy || !!config}
                    onClick={() => prepare(true)}
                  >
                    Generate from CRM data
                  </button>
                )}
                <button
                  disabled={busy || !!config}
                  onClick={() => setChooseTemplates((v) => !v)}
                >
                  Add from CRM templates
                </button>
                <button
                  disabled={busy || !!config}
                  onClick={() => fileInput.current?.click()}
                >
                  Upload
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  hidden
                  onChange={(e) => {
                    setItems((v) => [
                      ...v,
                      ...Array.from(e.target.files ?? []).map((file) => ({
                        id: crypto.randomUUID(),
                        name: file.name,
                        file,
                        selected: true,
                      })),
                    ]);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            {chooseTemplates && (
              <div className={styles.templates}>
                {templates.map((t) => (
                  <label key={t.id}>
                    <input
                      type="checkbox"
                      checked={items.some((i) => i.templateId === t.id)}
                      onChange={(e) =>
                        setItems((v) =>
                          e.target.checked
                            ? [
                                ...v,
                                {
                                  id: crypto.randomUUID(),
                                  name: t.name,
                                  templateId: t.id,
                                  selected: true,
                                },
                              ]
                            : v.filter((i) => i.templateId !== t.id),
                        )
                      }
                    />
                    {t.name} · {t.pageCount} pages
                  </label>
                ))}
                {!templates.length && (
                  <p>No active templates. Upload PDF documents instead.</p>
                )}
              </div>
            )}
            {busy && !config && <p role="status" className={styles.hint}>Preparing your documents from CRM details…</p>}
            {config ? (
              config.documents.map((d) => (
                <div className={styles.row} key={d.id}>
                  <span className={styles.fileIcon}>PDF</span>
                  <div className={styles.grow}>
                    <strong>{d.name}</strong>
                    <small>{d.pageCount} pages</small>
                  </div>
                  <a
                    href={`${preview?.pdfUrl ?? `/api/esign/packets/${id}/pdf`}#page=${d.startPage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Review document
                  </a>
                </div>
              ))
            ) : plannedDocuments.length && !items.length ? (
              plannedDocuments.map((document) => (
                <div className={styles.row} key={document.name}>
                  <span className={styles.fileIcon}>DOC</span>
                  <div className={styles.grow}><strong>{document.name}</strong><small>{document.available ? (busy ? "Preparing…" : "Template available") : "Required template not uploaded"}</small></div>
                  {!document.available && <a href="/contracts/templates" target="_blank" rel="noopener noreferrer">Set up template</a>}
                </div>
              ))
            ) : items.length ? (
              items.map((item, i) => (
                <div className={styles.row} key={item.id}>
                  <input
                    aria-label={`Include ${item.name}`}
                    type="checkbox"
                    checked={item.selected}
                    onChange={(e) =>
                      setItems((v) =>
                        v.map((x) =>
                          x.id === item.id
                            ? { ...x, selected: e.target.checked }
                            : x,
                        ),
                      )
                    }
                  />
                  <span className={styles.fileIcon}>PDF</span>
                  <div className={styles.grow}>
                    <strong>{item.name}</strong>
                    <small>
                      {item.file
                        ? `${Math.round(item.file.size / 1024)} KB · PDF`
                        : "CRM template"}
                    </small>
                  </div>
                  <button
                    aria-label={`Move ${item.name} up`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${item.name} down`}
                    disabled={i === items.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`Remove ${item.name}`}
                    onClick={() =>
                      setItems((v) => v.filter((x) => x.id !== item.id))
                    }
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div className={styles.empty}>
                Add your agreement, addendum, payment processor and legal plan
                documents.
              </div>
            )}
          </section>
          {opportunityId && (
            <label>
              <input
                type="checkbox"
                checked={includeAddendum}
                disabled={busy || !!config || requiredAddendum}
                onChange={(e) => setIncludeAddendum(e.target.checked)}
              />{" "}
              {requiredAddendum ? "Addendum required for this opportunity" : "Include addendum when generating from CRM data"}
            </label>
          )}
          <p className={styles.hint}>
            Reorder documents here before placing fields. Each packet preserves
            the exact PDF pages used for signing.
          </p>
        </div>
      ) : step === 1 && config ? (
        <div className={styles.body}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Recipients</h2>
              <button
                onClick={() =>
                  setConfig({
                    ...config,
                    recipients: [
                      ...config.recipients,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        email: "",
                        action: "SIGN",
                        order: config.recipients.length + 1,
                      },
                    ],
                  })
                }
              >
                Add Recipient
              </button>
            </div>
            {config.recipients.map((r, i) => (
              <div className={styles.recipient} key={r.id}>
                <label>
                  Order
                  <input
                    aria-label={`Recipient ${i + 1} order`}
                    type="number"
                    min={1}
                    max={20}
                    value={r.order}
                    onChange={(e) =>
                      recipient(i, { order: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Name
                  <input
                    aria-label={`Recipient ${i + 1} name`}
                    value={r.name}
                    onChange={(e) => recipient(i, { name: e.target.value })}
                  />
                </label>
                <label>
                  Email
                  <input
                    aria-label={`Recipient ${i + 1} email`}
                    type="email"
                    value={r.email}
                    onChange={(e) => recipient(i, { email: e.target.value })}
                  />
                </label>
                <label>
                  Action
                  <select
                    value={r.action}
                    onChange={(e) =>
                      recipient(i, {
                        action: e.target.value as "SIGN" | "COPY",
                      })
                    }
                  >
                    <option value="SIGN">Needs to Sign</option>
                    <option value="COPY">Receives a Copy</option>
                  </select>
                </label>
                <button
                  aria-label={`Remove recipient ${i + 1}`}
                  onClick={() =>
                    setConfig({
                      ...config,
                      recipients: config.recipients.filter(
                        (x) => x.id !== r.id,
                      ),
                      fields: config.fields.filter(
                        (f) => f.recipientId !== r.id,
                      ),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </section>
          <section className={styles.settings}>
            <h2>Message to All Recipients</h2>
            <p className={styles.hint}>
              This message will be included with the signing invitation.
            </p>
            <label>
              Email Subject
              <input
                maxLength={200}
                value={config.subject}
                onChange={(e) =>
                  setConfig({ ...config, subject: e.target.value })
                }
              />
            </label>
            <label>
              Email Message
              <textarea
                maxLength={10000}
                value={config.message}
                onChange={(e) =>
                  setConfig({ ...config, message: e.target.value })
                }
              />
            </label>
            <details open>
              <summary>More Options</summary>
              <div className={styles.options}>
                <label>
                  Automatic Reminders
                  <select
                    value={config.reminderDays}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        reminderDays: Number(e.target.value),
                      })
                    }
                  >
                    <option value={0}>Off</option>
                    <option value={1}>Every day</option>
                    <option value={2}>Every 2 days</option>
                    <option value={3}>Every 3 days</option>
                    <option value={7}>Every week</option>
                  </select>
                </label>
                <label>
                  Envelope expires after (days)
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={config.expiresDays}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        expiresDays: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
            </details>
          </section>
        </div>
      ) : (
        config && (
          <PacketEditor
            url={preview?.pdfUrl ?? `/api/esign/packets/${id}/pdf`}
            config={config}
            onChange={setConfig}
          />
        )
      )}
      {!sent && (
        <footer className={styles.footer}>
          {step > 0 && (
            <button disabled={busy} onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step === 0 ? (
            <button
              className={styles.primary}
              disabled={busy || (!config && !items.some((i) => i.selected))}
              onClick={() => prepare()}
            >
              {busy ? "Preparing…" : "Next"}
            </button>
          ) : step === 1 ? (
            <button
              className={styles.primary}
              disabled={busy}
              onClick={() => save(2)}
            >
              Next
            </button>
          ) : (
            <>
              <button disabled={busy} onClick={() => save()}>
                Save draft
              </button>
              <button
                className={styles.primary}
                disabled={busy || !config?.fields.length}
                onClick={() => send()}
              >
                Send
              </button>
            </>
          )}
        </footer>
      )}
    </div>
  );
}
