"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Always-visible yellow sticky note pinned in the account right rail (under the
 * Escrow Balance card). Shows the latest Account note; click to edit it inline.
 * Saving edits the existing note (PATCH /api/notes/[id]) or, if there is none
 * yet, creates one (POST /api/notes) attached to the account.
 */
export function StickyNoteCard({
  accountId,
  note,
}: {
  accountId: string;
  note: { id: string; body: string } | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note?.body ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = note
        ? await fetch(`/api/notes/${note.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body }),
          })
        : await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body, accountId }),
          });
      if (res.ok) {
        setEditing(false);
        toast.success("Note saved");
        router.refresh();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(d.error ?? "Could not save the note");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      style={{
        background: "#fff7cd",
        border: "1px solid #f2e08a",
        borderRadius: 6,
        marginBottom: 8,
        padding: "10px 14px",
        boxShadow: "0 2px 3px rgba(0,0,0,.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span aria-hidden style={{ fontSize: 14 }}>📝</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#6b5900", flex: 1 }}>Sticky Note</span>
        {!editing && (
          <button
            onClick={() => { setText(note?.body ?? ""); setEditing(true); }}
            style={{ background: "none", border: "none", color: "#6b5900", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
          >
            {note ? "Edit" : "Add"}
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Write a note about this account..."
            style={{
              width: "100%",
              padding: 8,
              border: "1px solid #e3cf6b",
              borderRadius: 4,
              fontSize: 13,
              resize: "vertical",
              fontFamily: "inherit",
              background: "#fffdf3",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            <button
              onClick={() => { setEditing(false); setText(note?.body ?? ""); }}
              disabled={busy}
              style={{ background: "none", border: "1px solid #d9d0a0", borderRadius: 4, padding: "4px 12px", fontSize: 12, cursor: "pointer", color: "#6b5900" }}
            >
              Cancel
            </button>
            <button
              onClick={() => void save()}
              disabled={busy || !text.trim()}
              style={{ background: "#6b5900", border: "none", borderRadius: 4, padding: "4px 14px", fontSize: 12, fontWeight: 600, color: "#fff", cursor: busy ? "wait" : "pointer" }}
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </>
      ) : note ? (
        <div
          onClick={() => { setText(note.body); setEditing(true); }}
          style={{ fontSize: 13, color: "#3d3300", whiteSpace: "pre-wrap", cursor: "text", minHeight: 20 }}
        >
          {note.body}
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          style={{ fontSize: 13, color: "#8a7b3a", cursor: "text", fontStyle: "italic" }}
        >
          Click to add a note...
        </div>
      )}
    </article>
  );
}
