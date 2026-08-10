"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Unified Notes card shown on Lead, Opportunity and Account pages. Lists
 * every note across the linked chain, labeled by the record it came from
 * (Lead note / Opp note / Account note), with an add box on top. Adding a
 * note attaches it to the whole chain so it appears on all related pages.
 */

export interface RecordNote {
  id: string;
  body: string;
  source: "Lead" | "Opportunity" | "Account";
  author: string | null;
  createdAt: string;
}

const SOURCE_STYLE: Record<RecordNote["source"], { label: string; bg: string; color: string }> = {
  Lead: { label: "Lead note", bg: "#fdeee7", color: "#b3541e" },
  Opportunity: { label: "Opp note", bg: "#fdf3e2", color: "#8c5f10" },
  Account: { label: "Account note", bg: "#eef1f8", color: "#3052FF" },
};

export function RecordNotes({
  notes,
  attach,
}: {
  notes: RecordNote[];
  /** Chain ids the new note gets attached to (current record + its links). */
  attach: { leadId?: string | null; opportunityId?: string | null; accountId?: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, ...attach }),
      });
      if (res.ok) {
        setText("");
        toast.success("Note added");
        router.refresh();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(d.error ?? "Could not add the note");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        marginBottom: 8,
        overflow: "hidden",
        boxShadow: "0 2px 2px 0 rgba(0,0,0,.05)",
      }}
    >
      <header
        style={{
          background: "#fafaf9",
          borderBottom: open ? "1px solid #c9c9c9" : "none",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          style={{ fill: "#747474", transform: open ? "rotate(90deg)" : "none", transition: "transform .1s" }}
          aria-hidden="true"
        >
          <path d="M2 0l6 5-6 5z" />
        </svg>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181818", margin: 0 }}>
          Notes ({notes.length})
        </h3>
      </header>

      {open && (
        <div style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="Write a note..."
              style={{
                flex: 1,
                padding: 8,
                border: "1px solid #c9c7c5",
                borderRadius: 4,
                fontSize: 13,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={add}
              disabled={busy || !text.trim()}
              style={{
                alignSelf: "flex-end",
                background: "#0176d3",
                border: "none",
                padding: "8px 16px",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {busy ? "Saving..." : "Add Note"}
            </button>
          </div>

          {notes.length === 0 ? (
            <div style={{ padding: "8px 0", fontSize: 13, color: "#747474" }}>No notes yet.</div>
          ) : (
            notes.map((n) => {
              const st = SOURCE_STYLE[n.source];
              return (
                <div key={n.id} style={{ padding: "8px 0", borderTop: "1px solid #f3f3f3" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span
                      style={{
                        padding: "1px 10px",
                        borderRadius: 10,
                        background: st.bg,
                        color: st.color,
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {st.label}
                    </span>
                    {n.author && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#181818" }}>{n.author}</span>
                    )}
                    <span style={{ fontSize: 12, color: "#747474" }}>
                      {new Date(n.createdAt).toLocaleString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        year: "2-digit",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#181818", whiteSpace: "pre-wrap" }}>{n.body}</div>
                </div>
              );
            })
          )}
        </div>
      )}
    </article>
  );
}
