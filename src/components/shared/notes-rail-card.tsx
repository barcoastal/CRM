"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * SF-style Notes card for the activity rail: header with note icon +
 * "Notes (n)" + New button, entries with a bold title line, "date by author"
 * meta and a preview, plus View All expansion. Mirrors the SF card Bar
 * screenshotted on the Travis James opportunity.
 */

export interface RailNote {
  id: string;
  body: string;
  author: string | null;
  createdAt: string;
  source: "Lead" | "Opportunity" | "Account";
}

export function NotesRailCard({
  notes,
  attach,
}: {
  notes: RailNote[];
  attach: { leadId?: string | null; opportunityId?: string | null; accountId?: string | null };
}) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = showAll ? notes : notes.slice(0, 2);

  async function save() {
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
        setComposing(false);
        toast.success("Note added");
        router.refresh();
      } else {
        toast.error("Could not add the note");
      }
    } finally {
      setBusy(false);
    }
  }

  const titleOf = (body: string): { title: string; preview: string } => {
    const lines = body.split("\n");
    const first = (lines[0] ?? "").trim();
    if (first.length > 0 && first.length <= 60 && lines.length > 1) {
      return { title: first, preview: lines.slice(1).join(" ").trim() };
    }
    return { title: first.length > 60 ? "Untitled Note" : first || "Untitled Note", preview: first.length > 60 ? body : lines.slice(1).join(" ").trim() };
  };

  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        marginBottom: 8,
        boxShadow: "0 2px 2px 0 rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: 4,
            background: "#e6a03c",
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 52 52" style={{ fill: "#fff" }}>
            <path d="M44 4H14c-2.2 0-4 1.8-4 4v2H8c-1.1 0-2 .9-2 2s.9 2 2 2h2v8H8c-1.1 0-2 .9-2 2s.9 2 2 2h2v8H8c-1.1 0-2 .9-2 2s.9 2 2 2h2v2c0 2.2 1.8 4 4 4h30c2.2 0 4-1.8 4-4V8c0-2.2-1.8-4-4-4zM24 38h-6c-1.1 0-2-.9-2-2s.9-2 2-2h6c1.1 0 2 .9 2 2s-.9 2-2 2zm10-8H18c-1.1 0-2-.9-2-2s.9-2 2-2h16c1.1 0 2 .9 2 2s-.9 2-2 2zm4-8H18c-1.1 0-2-.9-2-2s.9-2 2-2h20c1.1 0 2 .9 2 2s-.9 2-2 2z" />
          </svg>
        </span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181818", margin: 0, flex: 1 }}>
          Notes ({notes.length})
        </h3>
        <button
          onClick={() => setComposing((v) => !v)}
          style={{
            background: "#fff",
            border: "1px solid #c9c9c9",
            borderRadius: 4,
            padding: "3px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: "#0176d3",
            cursor: "pointer",
          }}
        >
          New
        </button>
      </header>

      {composing && (
        <div style={{ padding: "0 12px 10px", display: "flex", gap: 8 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            autoFocus
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
            onClick={save}
            disabled={busy || !text.trim()}
            style={{
              alignSelf: "flex-end",
              background: "#0176d3",
              border: "none",
              padding: "7px 14px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            Save
          </button>
        </div>
      )}

      {notes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: visible.length > 1 ? "1fr 1fr" : "1fr", gap: 0, borderTop: "1px solid #ecebea" }}>
          {visible.map((n, i) => {
            const { title, preview } = titleOf(n.body);
            const when = new Date(n.createdAt);
            return (
              <div
                key={n.id}
                style={{
                  padding: "10px 12px",
                  borderLeft: i % 2 === 1 ? "1px solid #ecebea" : "none",
                  borderTop: i > 1 ? "1px solid #ecebea" : "none",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0176d3",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title}
                </div>
                <div style={{ fontSize: 11, color: "#747474", margin: "2px 0 4px" }}>
                  {when.toLocaleDateString("en-US")} at {when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  {n.author ? ` by ${n.author}` : ""}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#444444",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {preview || n.body}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {notes.length > 2 && (
        <div style={{ textAlign: "center", padding: "8px 12px", borderTop: "1px solid #ecebea" }}>
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{ background: "none", border: 0, color: "#0176d3", fontSize: 12, cursor: "pointer" }}
          >
            {showAll ? "Show Less" : "View All"}
          </button>
        </div>
      )}
    </article>
  );
}
