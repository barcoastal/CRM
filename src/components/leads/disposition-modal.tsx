"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalButton } from "@/components/slds/modal";
import { CALL_RESULTS, DISPOSITION_TASK_STATUSES } from "@/lib/sf-canonical";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 10px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
  color: "#080707",
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 400,
  color: "#3e3e3c",
  marginBottom: 4,
};

const requiredMark = <span style={{ color: "#c23934", marginRight: 2 }}>*</span>;

export type DispositionModalProps = {
  /** API endpoint to POST {stage, subDisposition, subject, callResult, status, description} */
  endpoint: string;
  /** All allowed stages (in path order) */
  stages: readonly string[];
  /** Map of stage → allowed sub-dispositions */
  subDispositionsByStage: Record<string, readonly string[]>;
  /** Current stage value */
  currentStage: string;
  open: boolean;
  onClose: () => void;
  /**
   * Optional. When provided, called after a successful save INSTEAD of the
   * default router refresh/redirect — the caller decides what happens next
   * (e.g. the dialer clears the call pane and waits for the next call).
   */
  onSaved?: (out: {
    conversion?: { opportunityId: string | null; accountId: string };
    conversionError?: string;
  }) => void;
};

export function DispositionModal({
  endpoint,
  stages,
  subDispositionsByStage,
  currentStage,
  open,
  onClose,
  onSaved,
}: DispositionModalProps) {
  const router = useRouter();
  const [stage, setStage] = useState<string>(currentStage);
  const [subDispo, setSubDispo] = useState("");
  const [subject, setSubject] = useState<string>(currentStage);
  const [callResult, setCallResult] = useState("");
  const [status, setStatus] = useState("Completed");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const subOptions = useMemo(() => subDispositionsByStage[stage] ?? [], [stage, subDispositionsByStage]);

  function handleStageChange(s: string) {
    setStage(s);
    setSubject(s);
    setSubDispo("");
  }

  async function handleSave() {
    setError(null);
    if (!subDispo) {
      setError("Complete this field.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          subDisposition: subDispo,
          subject,
          callResult: callResult || null,
          status,
          description: description || null,
        }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(msg ?? "Save failed");
      }
      const out = (await res.json().catch(() => ({}))) as {
        conversion?: { opportunityId: string | null; accountId: string };
        redirectTo?: string;
        conversionError?: string;
      };
      onClose();
      if (onSaved) {
        onSaved(out);
        return;
      }
      if (out.redirectTo) {
        router.push(out.redirectTo);
      } else if (out.conversion?.opportunityId) {
        router.push(`/opportunities/${out.conversion.opportunityId}`);
      } else if (out.conversion?.accountId) {
        router.push(`/accounts/${out.conversion.accountId}`);
      } else {
        router.refresh();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="medium"
      footer={
        <>
          <ModalButton onClick={onClose} variant="neutral">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" style={{ fill: "currentColor" }}>
                <path d="M9.5 3.5L8.5 2.5L6 5 3.5 2.5 2.5 3.5 5 6 2.5 8.5 3.5 9.5 6 7 8.5 9.5 9.5 8.5 7 6z" />
              </svg>
              Cancel
            </span>
          </ModalButton>
          <ModalButton onClick={handleSave} variant="brand" disabled={saving}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg width="11" height="11" viewBox="0 0 14 14" style={{ fill: "currentColor" }}>
                <path d="M11 1H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zM6 11L2 7l1.4-1.4L6 8.2 10.6 3.6 12 5z" />
              </svg>
              {saving ? "Saving…" : "Save"}
            </span>
          </ModalButton>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>{requiredMark}Stage</label>
          <select
            value={stage}
            onChange={(e) => handleStageChange(e.target.value)}
            style={inputStyle}
          >
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{requiredMark}Sub Disposition</label>
          <select
            value={subDispo}
            onChange={(e) => setSubDispo(e.target.value)}
            style={{
              ...inputStyle,
              borderColor: error && !subDispo ? "#c23934" : inputStyle.border as string,
            }}
          >
            <option value="">Select Sub Disposition</option>
            {subOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {error && !subDispo && (
            <div style={{ color: "#c23934", fontSize: 11, marginTop: 4 }}>{error}</div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          paddingBottom: 6,
          borderBottom: "1px solid #ecebea",
        }}
      >
        <span
          style={{
            background: "#4bca81",
            width: 24,
            height: 24,
            borderRadius: 4,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" style={{ fill: "#fff" }}>
            <path d="M10 1H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zM6 11L3 8l1-1 2 2 4-4 1 1z" />
          </svg>
        </span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Log Disposition</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Call Result</label>
          <select value={callResult} onChange={(e) => setCallResult(e.target.value)} style={inputStyle}>
            <option value="">--None--</option>
            {CALL_RESULTS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>{requiredMark}Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            {DISPOSITION_TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, height: 64, padding: 8, resize: "vertical" }}
          />
        </div>
      </div>
    </Modal>
  );
}
