"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RequestDecisionPanel({
  requestId,
  canApprove,
  canRecall,
  status,
}: {
  requestId: string;
  canApprove: boolean;
  canRecall: boolean;
  status: string;
}) {
  const router = useRouter();
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | "recall" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "reject" | "recall") {
    if (action === "reject" && !comments.trim()) {
      setError("Comments are required to reject.");
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/requests/${requestId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `${action} failed`);
      } else {
        setComments("");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  if (status !== "PENDING") {
    return (
      <div
        className="bg-white rounded-xl p-5"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div className="text-[14px] font-bold text-[#131b2e]">Decision</div>
        <div className="text-[12px] text-[#706e6b] mt-1">
          This request is {status.toLowerCase()}. No further action is possible.
        </div>
      </div>
    );
  }

  if (!canApprove && !canRecall) {
    return (
      <div
        className="bg-white rounded-xl p-5"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <div className="text-[14px] font-bold text-[#131b2e]">Decision</div>
        <div className="text-[12px] text-[#706e6b] mt-1">
          You are not an approver for the current step.
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-xl p-5 space-y-3"
      style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
    >
      <div className="text-[14px] font-bold text-[#131b2e]">Decision</div>
      <textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        rows={3}
        placeholder="Comments (required for reject)"
        className="w-full px-3 py-2 border border-[#d8dde6] rounded text-[13px] outline-none focus:border-[#3052ff] resize-y"
      />
      {error && (
        <div className="text-[12px] text-[#9d1414] bg-[#fde2e2] px-3 py-2 rounded">{error}</div>
      )}
      <div className="flex flex-col gap-2">
        {canApprove && (
          <>
            <button
              type="button"
              onClick={() => run("approve")}
              disabled={busy !== null}
              className="px-4 py-2 rounded text-[13px] font-semibold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #1f8a4f, #1ba455)" }}
            >
              {busy === "approve" ? "Approving..." : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => run("reject")}
              disabled={busy !== null}
              className="px-4 py-2 rounded text-[13px] font-semibold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #b1271b, #c0392b)" }}
            >
              {busy === "reject" ? "Rejecting..." : "Reject"}
            </button>
          </>
        )}
        {canRecall && (
          <button
            type="button"
            onClick={() => run("recall")}
            disabled={busy !== null}
            className="px-4 py-2 rounded text-[13px] font-semibold text-[#444656] bg-[#f2f3ff] disabled:opacity-60"
          >
            {busy === "recall" ? "Recalling..." : "Recall Request"}
          </button>
        )}
      </div>
    </div>
  );
}
