"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewChatterGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/chatter/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          visibility,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to create group");
        setSubmitting(false);
        return;
      }
      const g = await res.json();
      router.push(`/chatter/groups/${g.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "20px 24px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 16, fontSize: 12, color: "#706e6b" }}>
        <Link href="/chatter/groups" style={{ color: "#0070d2", textDecoration: "none" }}>Groups</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <span>New Group</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#080707", margin: 0, marginBottom: 16 }}>
        Create Chatter Group
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          border: "1px solid #d8dde6",
          borderRadius: 6,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div>
          <label style={labelStyle}>Name <span style={{ color: "#c23934" }}>*</span></label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sales Team"
            style={inputStyle}
            maxLength={120}
            autoFocus
          />
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this group about?"
            rows={3}
            maxLength={1000}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <div>
          <label style={labelStyle}>Visibility</label>
          <div style={{ display: "flex", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input
                type="radio"
                checked={visibility === "public"}
                onChange={() => setVisibility("public")}
              />
              Public, anyone can see and join
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input
                type="radio"
                checked={visibility === "private"}
                onChange={() => setVisibility("private")}
              />
              Private, by invitation only
            </label>
          </div>
        </div>

        {error && (
          <div style={{ color: "#c23934", fontSize: 13, padding: 8, background: "#fef0f0", borderRadius: 4 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #ecebea", paddingTop: 14 }}>
          <Link
            href="/chatter/groups"
            style={{
              padding: "6px 14px", background: "#fff", color: "#0070d2",
              border: "1px solid #d8dde6", borderRadius: 4,
              fontSize: 13, fontWeight: 500, textDecoration: "none",
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "6px 14px",
              background: submitting ? "#c9c7c5" : "#0070d2",
              color: "#fff",
              border: 0,
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "Creating..." : "Create Group"}
          </button>
        </div>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#3e3e3c",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};
