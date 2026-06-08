"use client";

/**
 * Send-from-Opportunity modal. Pairs with /api/esign/envelopes/send.
 *
 * Lifecycle:
 *  - on `open`, fetch active templates once
 *  - user picks template -> documentName is auto-filled if blank
 *  - submit calls POST /api/esign/envelopes/send, then shows the signing URL
 *    so the rep can copy it or jump to it
 *
 * Intentionally NOT wired through the existing /api/envelopes/* single-blob
 * flow. The two flows coexist: template-driven send (this modal) and
 * upload-a-PDF blob (the older NewEnvelopeModal).
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface TemplateOption {
  id: string;
  name: string;
  recordType: string;
  pageCount: number;
  fieldCount: number;
  isActive: boolean;
}

export interface SendContractModalProps {
  opportunityId: string;
  defaultSigner?: { name?: string | null; email?: string | null; phone?: string | null };
  open: boolean;
  onClose: () => void;
}

export function SendContractModal({ opportunityId, defaultSigner, open, onClose }: SendContractModalProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [signerName, setSignerName] = useState(defaultSigner?.name ?? "");
  const [signerEmail, setSignerEmail] = useState(defaultSigner?.email ?? "");
  const [signerPhone, setSignerPhone] = useState(defaultSigner?.phone ?? "");
  const [documentName, setDocumentName] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ envelopeId: string; signingUrl: string; emailSent: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    fetch("/api/esign/templates")
      .then((r) => r.json())
      .then((j: { items?: TemplateOption[] }) => {
        const items = (j.items ?? []).filter((t) => t.isActive);
        setTemplates(items);
        if (items.length === 1) setTemplateId(items[0].id);
      })
      .catch(() => toast.error("Failed to load templates"))
      .finally(() => setLoadingTemplates(false));
  }, [open]);

  // Reset on close so the next open is clean.
  useEffect(() => {
    if (open) return;
    setResult(null);
    setSending(false);
  }, [open]);

  // Keep defaults synced when the parent feeds in fresh signer info between opens.
  useEffect(() => {
    setSignerName(defaultSigner?.name ?? "");
    setSignerEmail(defaultSigner?.email ?? "");
    setSignerPhone(defaultSigner?.phone ?? "");
  }, [defaultSigner?.name, defaultSigner?.email, defaultSigner?.phone]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  // Auto-fill the documentName field whenever a template is picked and the
  // user has not typed their own override yet.
  useEffect(() => {
    if (!selectedTemplate) return;
    setDocumentName((prev) => (prev.trim() ? prev : selectedTemplate.name));
  }, [selectedTemplate]);

  if (!open) return null;

  async function send() {
    if (!templateId) return toast.error("Pick a template");
    if (!signerName.trim()) return toast.error("Signer name required");
    if (!signerEmail.trim()) return toast.error("Signer email required");

    setSending(true);
    try {
      const res = await fetch("/api/esign/envelopes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId,
          templateId,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
          signerPhone: signerPhone.trim() || undefined,
          documentName: documentName.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        envelopeId?: string;
        signingUrl?: string;
        emailSent?: boolean;
        emailError?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.envelopeId || !data.signingUrl) {
        toast.error(data.error ?? "Send failed");
        return;
      }
      if (data.emailSent) {
        toast.success(`Sent to ${signerEmail}`);
      } else {
        toast.warning(`Envelope created but email failed: ${data.emailError ?? "unknown"}`);
      }
      setResult({ envelopeId: data.envelopeId, signingUrl: data.signingUrl, emailSent: !!data.emailSent });
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    await navigator.clipboard.writeText(result.signingUrl);
    toast.success("Signing link copied");
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <header style={headerStyle}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Send Contract</h2>
          <button onClick={onClose} style={closeBtn} aria-label="Close">×</button>
        </header>
        <div style={{ padding: 16 }}>
          {result ? (
            <div>
              <p style={{ fontSize: 13, marginTop: 0 }}>
                Envelope sent. The signer will receive an email with a link to review and sign.
              </p>
              <label style={lbl}>Signing link</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input readOnly value={result.signingUrl} style={{ ...inp, flex: 1 }} />
                <button style={primaryBtn} onClick={copyLink}>Copy</button>
              </div>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <a href={result.signingUrl} target="_blank" rel="noreferrer" style={{ ...secondaryBtn, textDecoration: "none" }}>
                  Preview signer page
                </a>
                <button style={primaryBtn} onClick={onClose}>Done</button>
              </div>
            </div>
          ) : (
            <>
              <label style={lbl}>Template</label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={inp} disabled={loadingTemplates}>
                <option value="">
                  {loadingTemplates ? "Loading..." : templates.length === 0 ? "No active templates" : "Select a template"}
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.recordType}, {t.pageCount}p, {t.fieldCount} fields)
                  </option>
                ))}
              </select>

              <label style={lbl}>Signer name</label>
              <input value={signerName} onChange={(e) => setSignerName(e.target.value)} style={inp} placeholder="Jane Doe" />

              <label style={lbl}>Signer email</label>
              <input value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} style={inp} placeholder="jane@example.com" type="email" />

              <label style={lbl}>Signer phone (optional)</label>
              <input value={signerPhone} onChange={(e) => setSignerPhone(e.target.value)} style={inp} placeholder="(555) 555 5555" />

              <label style={lbl}>Document name</label>
              <input value={documentName} onChange={(e) => setDocumentName(e.target.value)} style={inp} placeholder="Engagement Agreement" />

              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button style={secondaryBtn} onClick={onClose} disabled={sending}>Cancel</button>
                <button style={primaryBtn} onClick={send} disabled={sending || !templateId}>
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 6,
  width: "100%",
  maxWidth: 460,
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  borderBottom: "1px solid #ecebea",
};
const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  fontSize: 22,
  cursor: "pointer",
  color: "#706e6b",
  lineHeight: 1,
};
const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#3e3e3c",
  margin: "10px 0 4px",
};
const inp: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  fontSize: 13,
  boxSizing: "border-box",
};
const primaryBtn: React.CSSProperties = {
  background: "#0070d2",
  color: "#fff",
  border: 0,
  padding: "6px 14px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  background: "#fff",
  color: "#0070d2",
  border: "1px solid #d8dde6",
  padding: "6px 14px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
