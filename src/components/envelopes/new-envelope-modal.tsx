"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal, ModalButton } from "@/components/slds/modal";

const RECORD_TYPES = [
  ["CONTRACT", "Engagement Agreement"],
  ["BANK_CHANGE", "Bank Change Authorization"],
  ["DISCLOSURE", "Disclosure / Consent"],
  ["AMENDMENT", "Program Amendment"],
  ["OTHER", "Other"],
];

const TEMPLATE_PRESETS: Record<string, { name: string; document: string }> = {
  CONTRACT: { name: "Engagement Agreement", document: "Coastal Debt Engagement Agreement" },
  BANK_CHANGE: { name: "Bank Change Authorization", document: "Bank Account Change Authorization" },
  DISCLOSURE: { name: "Disclosure", document: "Program Disclosure & Consent" },
  AMENDMENT: { name: "Amendment", document: "Program Amendment" },
  OTHER: { name: "Document", document: "Document" },
};

const input: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 10px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
  background: "#fff",
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#3e3e3c",
  marginBottom: 4,
};

export function NewEnvelopeModal({
  open,
  onClose,
  opportunityId,
  accountId,
  leadId,
  defaultSignerName,
  defaultSignerEmail,
}: {
  open: boolean;
  onClose: () => void;
  opportunityId?: string;
  accountId?: string;
  leadId?: string;
  defaultSignerName?: string;
  defaultSignerEmail?: string;
}) {
  const router = useRouter();
  const [recordType, setRecordType] = useState("CONTRACT");
  const [signerName, setSignerName] = useState(defaultSignerName ?? "");
  const [signerEmail, setSignerEmail] = useState(defaultSignerEmail ?? "");
  const [signerPhone, setSignerPhone] = useState("");
  const [templateName, setTemplateName] = useState(TEMPLATE_PRESETS.CONTRACT.name);
  const [documentName, setDocumentName] = useState(TEMPLATE_PRESETS.CONTRACT.document);
  const [documentUrl, setDocumentUrl] = useState("");
  const [sendImmediately, setSendImmediately] = useState(true);
  const [emailLink, setEmailLink] = useState(true);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ signingUrl?: string } | null>(null);

  function handleTypeChange(value: string) {
    setRecordType(value);
    const preset = TEMPLATE_PRESETS[value];
    if (preset) {
      setTemplateName(preset.name);
      setDocumentName(preset.document);
    }
  }

  async function submit() {
    if (!signerName || !signerEmail || !documentName) {
      toast.error("Signer name, email, and document name are required");
      return;
    }
    setCreating(true);
    try {
      const createRes = await fetch("/api/envelopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType,
          opportunityId,
          accountId,
          leadId,
          signerName,
          signerEmail,
          signerPhone: signerPhone || null,
          templateName,
          documentName,
          documentUrl: documentUrl || null,
        }),
      });
      if (!createRes.ok) {
        const { error } = await createRes.json().catch(() => ({ error: "Create failed" }));
        throw new Error(error ?? "Create failed");
      }
      const envelope = await createRes.json();

      if (!sendImmediately) {
        toast.success("Envelope drafted");
        router.refresh();
        onClose();
        return;
      }

      const sendRes = await fetch(`/api/envelopes/${envelope.id}/send`, { method: "POST" });
      const sendData = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok) {
        throw new Error(sendData.error ?? "Send failed");
      }

      // Optionally fire the signing link email
      if (emailLink && signerEmail) {
        await fetch("/api/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            direction: "OUTBOUND",
            status: "QUEUED",
            fromAddress: "no-reply@coastaldebt.com",
            toAddresses: signerEmail,
            subject: `Action required: please sign — ${documentName}`,
            bodyText: `Hi ${signerName},\n\nYou have a document waiting for your signature:\n\n${documentName}\n\nClick to review and sign:\n${sendData.signingUrl}\n\nThanks,\nCoastal Debt`,
            opportunityId: opportunityId ?? null,
            accountId: accountId ?? null,
            leadId: leadId ?? null,
          }),
        }).catch(() => undefined);
      }

      toast.success("Envelope sent");
      setResult({ signingUrl: sendData.signingUrl });
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Envelope"
      size="medium"
      footer={
        result ? (
          <ModalButton variant="brand" onClick={onClose}>
            Done
          </ModalButton>
        ) : (
          <>
            <ModalButton variant="neutral" onClick={onClose}>Cancel</ModalButton>
            <ModalButton variant="brand" disabled={creating} onClick={submit}>
              {creating ? "Sending…" : sendImmediately ? "Create & Send" : "Save as Draft"}
            </ModalButton>
          </>
        )
      }
    >
      {result ? (
        <div>
          <div style={{ background: "#ddf5d6", border: "1px solid #4bca81", borderRadius: 4, padding: 12, marginBottom: 16 }}>
            ✓ Envelope sent. Signing link copied below — also emailed to {signerEmail}.
          </div>
          <label style={label}>Public signing URL</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={result.signingUrl ?? ""} readOnly style={input} />
            <button
              onClick={() => {
                navigator.clipboard.writeText(result.signingUrl ?? "");
                toast.success("Copied");
              }}
              style={{
                background: "#fff",
                border: "1px solid #d8dde6",
                padding: "0 12px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                color: "#0070d2",
                cursor: "pointer",
              }}
            >
              Copy
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={label}>Envelope Type</label>
              <select value={recordType} onChange={(e) => handleTypeChange(e.target.value)} style={input}>
                {RECORD_TYPES.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Template Name</label>
              <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Document Name</label>
              <input value={documentName} onChange={(e) => setDocumentName(e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Document URL (optional)</label>
              <input
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="https://… or /uploads/…"
                style={input}
              />
            </div>
            <div>
              <label style={label}>Signer Name *</label>
              <input value={signerName} onChange={(e) => setSignerName(e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Signer Email *</label>
              <input value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} style={input} />
            </div>
            <div>
              <label style={label}>Signer Phone (optional)</label>
              <input value={signerPhone} onChange={(e) => setSignerPhone(e.target.value)} style={input} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={sendImmediately}
                onChange={(e) => setSendImmediately(e.target.checked)}
              />
              Send immediately (otherwise saves as Draft)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: sendImmediately ? 1 : 0.5 }}>
              <input
                type="checkbox"
                checked={emailLink}
                disabled={!sendImmediately}
                onChange={(e) => setEmailLink(e.target.checked)}
              />
              Email signing link to {signerEmail || "the signer"}
            </label>
          </div>
        </>
      )}
    </Modal>
  );
}
