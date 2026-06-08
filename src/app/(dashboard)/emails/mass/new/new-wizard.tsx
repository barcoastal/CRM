"use client";

/**
 * Three-step mass email creation wizard:
 *   1. Name + template + from picker
 *   2. Audience builder (filter or list)
 *   3. Preview the merged body + recipient count, then Send
 *
 * Step 3 saves the draft (if it hasn't been saved yet), fetches a preview
 * from the API, and exposes a Send button that POSTs to /send. Confirmation
 * modal asks "Send to N recipients?" before firing.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AudienceBuilder, type AudienceState } from "@/components/mass-email/audience-builder";
import { PreviewPane } from "@/components/mass-email/preview-pane";

interface TemplateOption {
  id: string;
  name: string;
  subject: string;
  folder: string | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

const STEPS: { id: 1 | 2 | 3; label: string }[] = [
  { id: 1, label: "Details" },
  { id: 2, label: "Audience" },
  { id: 3, label: "Preview and Send" },
];

export function NewMassEmailWizard({
  templates,
  users,
  defaultFromUserId,
}: {
  templates: TemplateOption[];
  users: UserOption[];
  defaultFromUserId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [fromUserId, setFromUserId] = useState<string>(defaultFromUserId);

  const [audience, setAudience] = useState<AudienceState>({
    audienceType: "filter",
    audienceFilter: { entityType: "Lead", filters: {} },
    audienceIds: [],
  });
  const [recipientCount, setRecipientCount] = useState(0);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [previewEmail, setPreviewEmail] = useState<string | undefined>(undefined);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persistDraft(): Promise<string | null> {
    if (draftId) {
      // Update existing draft
      const res = await fetch(`/api/emails/mass/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          templateId,
          fromUserId,
          audienceType: audience.audienceType,
          audienceFilter: audience.audienceFilter,
          audienceIds: audience.audienceIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save draft");
        return null;
      }
      return draftId;
    }
    setSavingDraft(true);
    const res = await fetch("/api/emails/mass", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        templateId,
        fromUserId,
        audienceType: audience.audienceType,
        audienceFilter: audience.audienceFilter,
        audienceIds: audience.audienceIds,
      }),
    });
    setSavingDraft(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save draft");
      return null;
    }
    const data = await res.json();
    setDraftId(data.id);
    return data.id as string;
  }

  async function loadPreview(id: string) {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/emails/mass/${id}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load preview");
        return;
      }
      setPreviewSubject(data.subject ?? "");
      setPreviewHtml(data.html ?? "");
      setPreviewText(data.text ?? "");
      setPreviewEmail(data.recipient?.email);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function goToStep3() {
    setError(null);
    if (!name.trim()) {
      setError("Please enter a blast name");
      return;
    }
    if (!templateId) {
      setError("Please pick a template");
      return;
    }
    if (recipientCount === 0) {
      setError("Audience is empty. Adjust filters or paste valid IDs.");
      return;
    }
    const id = await persistDraft();
    if (id) {
      setStep(3);
      await loadPreview(id);
    }
  }

  async function performSend() {
    if (!draftId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/emails/mass/${draftId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Send failed");
        return;
      }
      router.push(`/emails/mass/${draftId}`);
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  // When user goes back from step 3 and edits, persist on transition.
  useEffect(() => {
    if (step === 3 && draftId) {
      // re-persist whenever the wizard hops back into step 3 — already covered by goToStep3
    }
  }, [step, draftId]);

  return (
    <div className="space-y-4" style={{ fontFamily: "Manrope, sans-serif" }}>
      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className="size-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors"
              style={{
                background: step >= s.id ? "linear-gradient(135deg, #0034e4, #3052ff)" : "#f2f3ff",
                color: step >= s.id ? "white" : "#444656",
              }}
            >
              {s.id}
            </div>
            <div
              className="text-[12px] font-semibold"
              style={{ color: step >= s.id ? "#131b2e" : "#706e6b" }}
            >
              {s.label}
            </div>
            {idx < STEPS.length - 1 && (
              <div className="w-8 h-px" style={{ background: "#d8dde6" }} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] text-[12px] px-3 py-2">
          {error}
        </div>
      )}

      <section
        className="bg-white rounded-xl p-6"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-1">
                Blast Name
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="May 2026 reactivation outreach"
                className="w-full h-9 rounded border border-[#d8dde6] px-3 text-[13px] text-[#131b2e]"
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-1">
                Template
              </div>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full h-9 rounded border border-[#d8dde6] px-3 text-[13px] text-[#131b2e] bg-white"
              >
                {templates.length === 0 && <option value="">No templates yet</option>}
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.folder ? `[${t.folder}] ` : ""}
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-1">
                Send From (User)
              </div>
              <select
                value={fromUserId}
                onChange={(e) => setFromUserId(e.target.value)}
                className="w-full h-9 rounded border border-[#d8dde6] px-3 text-[13px] text-[#131b2e] bg-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!name.trim() || !templateId}
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded text-white text-[13px] font-semibold disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <AudienceBuilder
              value={audience}
              onChange={setAudience}
              onCountChange={setRecipientCount}
            />
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded border border-[#d8dde6] text-[13px] font-semibold text-[#131b2e] bg-white hover:bg-[#f2f3ff]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={goToStep3}
                disabled={recipientCount === 0 || savingDraft}
                className="px-5 py-2.5 rounded text-white text-[13px] font-semibold disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
              >
                {savingDraft ? "Saving..." : "Preview"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg px-4 py-3 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, rgba(48,82,255,0.06), rgba(48,82,255,0.02))" }}
            >
              <div className="text-[12px] text-[#444656]">Will send to</div>
              <div className="text-[20px] font-bold text-[#131b2e]">
                {recipientCount.toLocaleString()} recipient{recipientCount === 1 ? "" : "s"}
              </div>
            </div>

            {previewLoading ? (
              <div className="text-[13px] text-[#706e6b]">Loading preview...</div>
            ) : (
              <PreviewPane
                subject={previewSubject}
                html={previewHtml}
                text={previewText}
                recipientEmail={previewEmail}
              />
            )}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded border border-[#d8dde6] text-[13px] font-semibold text-[#131b2e] bg-white hover:bg-[#f2f3ff]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={sending}
                className="px-5 py-2.5 rounded text-white text-[13px] font-semibold disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </section>

      {confirming && (
        <ConfirmModal
          recipientCount={recipientCount}
          sending={sending}
          onCancel={() => setConfirming(false)}
          onConfirm={performSend}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  recipientCount,
  sending,
  onCancel,
  onConfirm,
}: {
  recipientCount: number;
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(19,27,46,0.4)" }}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-md w-full mx-4"
        style={{ fontFamily: "Manrope, sans-serif", boxShadow: "0 20px 60px rgba(19,27,46,0.25)" }}
      >
        <div className="text-[18px] font-bold text-[#131b2e]">
          Send to {recipientCount.toLocaleString()} recipient{recipientCount === 1 ? "" : "s"}?
        </div>
        <div className="text-[13px] text-[#444656] mt-2">
          The email goes out immediately. Per-recipient open and click activity will be tracked back to this blast.
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="px-4 py-2 rounded border border-[#d8dde6] text-[13px] font-semibold text-[#131b2e] bg-white hover:bg-[#f2f3ff]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={sending}
            className="px-5 py-2 rounded text-white text-[13px] font-semibold disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
