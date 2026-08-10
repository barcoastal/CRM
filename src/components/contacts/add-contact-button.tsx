"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * "New Contact" button + modal for the Contacts related list on the Account
 * and Opportunity pages. Creates the contact linked to the business (account)
 * and optionally makes it the primary contact.
 */
export function AddContactButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    title: "",
    email: "",
    phone: "",
    setPrimary: false,
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: k === "setPrimary" ? e.target.checked : e.target.value }));

  async function save() {
    if (!f.firstName.trim()) {
      setError("First name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: f.firstName.trim(),
          lastName: f.lastName.trim(),
          title: f.title.trim() || null,
          email: f.email.trim() || null,
          phone: f.phone.trim() || null,
          primaryAccountId: accountId,
          setPrimaryForAccount: f.setPrimary,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Could not create the contact.");
        return;
      }
      toast.success("Contact added");
      setOpen(false);
      setF({ firstName: "", lastName: "", title: "", email: "", phone: "", setPrimary: false });
      router.refresh();
    } catch {
      setError("Network error, please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={btn}>
        New Contact
      </button>
      {open && (
        <div style={overlay} onClick={() => !busy && setOpen(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 14px", fontSize: 16, color: "#181818" }}>New Contact</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={label}>First name</label>
                <input value={f.firstName} onChange={set("firstName")} style={input} />
              </div>
              <div>
                <label style={label}>Last name</label>
                <input value={f.lastName} onChange={set("lastName")} style={input} />
              </div>
            </div>
            <label style={label}>Title</label>
            <input value={f.title} onChange={set("title")} style={input} placeholder="e.g. Owner" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={label}>Email</label>
                <input value={f.email} onChange={set("email")} style={input} type="email" />
              </div>
              <div>
                <label style={label}>Phone</label>
                <input value={f.phone} onChange={set("phone")} style={input} type="tel" />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#181818", margin: "2px 0 14px", cursor: "pointer" }}>
              <input type="checkbox" checked={f.setPrimary} onChange={set("setPrimary")} />
              Make this the primary contact
            </label>

            {error && <div style={{ margin: "0 0 10px", fontSize: 13, color: "#c23934" }}>{error}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setOpen(false)} disabled={busy} style={btnGhost}>
                Cancel
              </button>
              <button onClick={save} disabled={busy} style={btnPrimary}>
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  borderRadius: 4,
  padding: "0 12px",
  height: 28,
  fontSize: 12,
  fontWeight: 600,
  color: "#0176d3",
  cursor: "pointer",
};
const btnPrimary: React.CSSProperties = {
  background: "#0176d3",
  border: "none",
  padding: "6px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  color: "#fff",
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  padding: "6px 16px",
  borderRadius: 4,
  fontSize: 13,
  fontWeight: 600,
  color: "#444444",
  cursor: "pointer",
};
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(8,7,7,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 16,
};
const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 8,
  padding: 20,
  width: "100%",
  maxWidth: 440,
  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#444444",
  margin: "0 0 4px",
};
const input: React.CSSProperties = {
  width: "100%",
  height: 32,
  padding: "0 8px",
  border: "1px solid #c9c7c5",
  borderRadius: 4,
  fontSize: 13,
  marginBottom: 12,
  boxSizing: "border-box",
};
