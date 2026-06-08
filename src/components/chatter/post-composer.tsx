"use client";

import { useEffect, useRef, useState } from "react";

interface UserLite {
  id: string;
  name: string;
  email: string;
}

interface Props {
  /** Either provide groupId... */
  groupId?: string;
  /** ...or entityType + entityId. */
  entityType?: string;
  entityId?: string;
  /** For replies. */
  parentId?: string;
  placeholder?: string;
  /** Called after a successful post; receives the new post. */
  onPosted?: (post: unknown) => void;
}

/**
 * Chatter post composer with an inline @mention picker. As the user types `@`
 * followed by 1+ characters we fetch /api/users?search=... and show a dropdown.
 * Selecting a user inserts the token `@[<id>:<name>]` at the caret. The chip
 * itself is rendered visually below the textarea in a preview area.
 *
 * Token format is documented in src/lib/chatter/mentions.ts.
 */
export function PostComposer({
  groupId,
  entityType,
  entityId,
  parentId,
  placeholder = "Share an update, ask a question, @mention a teammate...",
  onPosted,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mention picker state.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<UserLite[]>([]);
  const [pickerIdx, setPickerIdx] = useState(0);
  // The start index of the current @query inside the textarea body.
  const queryStartRef = useRef<number | null>(null);

  // Debounced user search.
  useEffect(() => {
    if (!pickerOpen) return;
    const q = pickerQuery.trim();
    const handle = setTimeout(async () => {
      try {
        const url = q ? `/api/users?limit=10` : `/api/users?limit=10`;
        const res = await fetch(url);
        if (!res.ok) return;
        const j = await res.json();
        const users: UserLite[] = (j.users ?? []).filter((u: { name?: string; email?: string }) => {
          if (!q) return true;
          const hay = `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase();
          return hay.includes(q.toLowerCase());
        });
        setPickerResults(users.slice(0, 8));
        setPickerIdx(0);
      } catch {
        // ignore
      }
    }, 80);
    return () => clearTimeout(handle);
  }, [pickerOpen, pickerQuery]);

  function detectMentionAtCaret(textArea: HTMLTextAreaElement) {
    const value = textArea.value;
    const caret = textArea.selectionStart;
    // Walk back from caret to find a recent "@", stopping at whitespace.
    let i = caret - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === "@") {
        // Only treat as mention start if the previous char is a boundary.
        if (i === 0 || /\s/.test(value[i - 1])) {
          const query = value.slice(i + 1, caret);
          // No spaces or closing brackets in the query.
          if (/[\s\]]/.test(query)) return null;
          // If we already passed a closed token, abort.
          if (query.includes("[")) return null;
          return { start: i, query };
        }
        return null;
      }
      if (/\s/.test(ch)) return null;
      i--;
    }
    return null;
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    const det = detectMentionAtCaret(e.target);
    if (det) {
      queryStartRef.current = det.start;
      setPickerOpen(true);
      setPickerQuery(det.query);
    } else {
      setPickerOpen(false);
      queryStartRef.current = null;
    }
  }

  function insertMention(u: UserLite) {
    const ta = taRef.current;
    if (!ta) return;
    const start = queryStartRef.current ?? ta.selectionStart;
    const caret = ta.selectionStart;
    const before = body.slice(0, start);
    const after = body.slice(caret);
    const token = `@[${u.id}:${u.name}]`;
    const next = `${before}${token} ${after}`;
    setBody(next);
    setPickerOpen(false);
    queryStartRef.current = null;
    // Restore caret after the inserted token + space.
    requestAnimationFrame(() => {
      if (!taRef.current) return;
      const pos = (before + token + " ").length;
      taRef.current.focus();
      taRef.current.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!pickerOpen || pickerResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPickerIdx((i) => Math.min(pickerResults.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPickerIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(pickerResults[pickerIdx]);
    } else if (e.key === "Escape") {
      setPickerOpen(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { body: trimmed };
      if (parentId) {
        payload.parentId = parentId;
      } else if (groupId) {
        payload.groupId = groupId;
      } else if (entityType && entityId) {
        payload.entityType = entityType;
        payload.entityId = entityId;
      }
      const res = await fetch("/api/chatter/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to post");
        setSubmitting(false);
        return;
      }
      const post = await res.json();
      setBody("");
      setSubmitting(false);
      onPosted?.(post);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "relative", border: "1px solid #d8dde6", borderRadius: 6, background: "#fff" }}>
      <textarea
        ref={taRef}
        value={body}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={parentId ? 2 : 3}
        style={{
          width: "100%",
          padding: "10px 12px",
          border: 0,
          borderRadius: "6px 6px 0 0",
          fontSize: 14,
          fontFamily: "inherit",
          resize: "vertical",
          outline: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 10px",
          borderTop: "1px solid #ecebea",
          background: "#fafaf9",
          borderRadius: "0 0 6px 6px",
        }}
      >
        <div style={{ fontSize: 11, color: "#706e6b" }}>
          Type @ to mention a teammate
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {error && <span style={{ color: "#c23934", fontSize: 12 }}>{error}</span>}
          <button
            onClick={handleSubmit}
            disabled={submitting || !body.trim()}
            style={{
              padding: "6px 14px",
              background: submitting || !body.trim() ? "#c9c7c5" : "#0070d2",
              color: "#fff",
              border: 0,
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              cursor: submitting || !body.trim() ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Posting..." : parentId ? "Reply" : "Share"}
          </button>
        </div>
      </div>

      {pickerOpen && pickerResults.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% - 4px)",
            left: 10,
            zIndex: 50,
            background: "#fff",
            border: "1px solid #d8dde6",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            minWidth: 260,
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {pickerResults.map((u, i) => (
            <button
              key={u.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                width: "100%",
                background: i === pickerIdx ? "#f3f2f2" : "transparent",
                border: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "#16325c", color: "#fff",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#080707", fontWeight: 500 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: "#706e6b" }}>{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
