"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface EligibleProcess {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  stepCount: number;
  canSubmit: boolean;
}

interface PendingInfo {
  id: string;
  processId: string;
  submittedById: string | null;
  submittedAt: string;
}

const btnBase: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  color: "#0176d3",
  padding: "4px 12px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

/**
 * SubmitButton — drop-in for entity detail page headers.
 * On mount, queries the eligible endpoint for the given record. Shows nothing
 * if no processes apply. If a single process applies, clicking submits directly
 * after a confirmation. If multiple processes apply, opens a picker modal.
 */
export function SubmitButton({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<EligibleProcess[]>([]);
  const [pending, setPending] = useState<PendingInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/approvals/requests/eligible?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: EligibleProcess[]; pending: PendingInfo | null };
        if (!cancelled) {
          setItems(data.items ?? []);
          setPending(data.pending ?? null);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  if (!loaded) return null;

  if (pending) {
    return (
      <a
        href={`/approvals/requests/${pending.id}`}
        style={{ ...btnBase, background: "#fff5cf", color: "#7a5c00", borderColor: "#f0c93b" }}
      >
        Pending Approval
      </a>
    );
  }

  const submittable = items.filter((i) => i.canSubmit);
  if (submittable.length === 0) return null;

  async function submit(processId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/approvals/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId, entityType, entityId, comments }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(data.error ?? "Submit failed");
      } else {
        setOpen(false);
        setComments("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function onClick() {
    setOpen(true);
    if (submittable.length === 1) {
      setPickedId(submittable[0].id);
    } else {
      setPickedId(null);
    }
  }

  return (
    <>
      <button type="button" style={btnBase} onClick={onClick}>
        Submit for Approval
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 9500,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "60px 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 8,
              width: "min(520px, 100%)",
              boxShadow: "0 12px 40px rgba(19,27,46,0.18)",
              fontFamily: "Manrope, sans-serif",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #f2f3ff",
                fontSize: 16,
                fontWeight: 700,
                color: "#131b2e",
              }}
            >
              Submit for Approval
            </div>
            <div style={{ padding: 20 }}>
              {submittable.length > 1 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#444656", marginBottom: 6 }}>
                    Choose a process
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {submittable.map((p) => (
                      <label
                        key={p.id}
                        style={{
                          display: "flex",
                          gap: 8,
                          padding: "10px 12px",
                          border: pickedId === p.id ? "1px solid #3052ff" : "1px solid #c9c9c9",
                          borderRadius: 6,
                          cursor: "pointer",
                          background: pickedId === p.id ? "#f2f3ff" : "#fff",
                        }}
                      >
                        <input
                          type="radio"
                          name="process"
                          checked={pickedId === p.id}
                          onChange={() => setPickedId(p.id)}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#131b2e" }}>{p.name}</div>
                          {p.description && (
                            <div style={{ fontSize: 12, color: "#747474" }}>{p.description}</div>
                          )}
                          <div style={{ fontSize: 11, color: "#747474", marginTop: 2 }}>
                            {p.stepCount} step{p.stepCount === 1 ? "" : "s"}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {submittable.length === 1 && (
                <div style={{ fontSize: 13, color: "#444656", marginBottom: 14 }}>
                  This record matches <strong>{submittable[0].name}</strong>. Submitting will route through
                  {" "}
                  {submittable[0].stepCount} step{submittable[0].stepCount === 1 ? "" : "s"}.
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#444656", marginBottom: 6 }}>
                  Comments (optional)
                </div>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    border: "1px solid #c9c9c9",
                    borderRadius: 4,
                    padding: "8px 12px",
                    fontSize: 13,
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                  placeholder="Context for the approver..."
                />
              </div>
            </div>
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid #f2f3ff",
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{ ...btnBase, color: "#444656" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => pickedId && submit(pickedId)}
                disabled={busy || !pickedId}
                style={{
                  ...btnBase,
                  background: "linear-gradient(135deg, #0034e4, #3052ff)",
                  color: "#fff",
                  borderColor: "transparent",
                  opacity: busy || !pickedId ? 0.6 : 1,
                }}
              >
                {busy ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
