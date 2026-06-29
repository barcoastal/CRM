"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Section, FieldGrid } from "@/components/slds/section";

interface Option {
  id: string;
  name: string;
  label?: string;
}

export function UserForm({
  initial,
  profiles,
  roles,
  managers,
  userId,
}: {
  initial?: {
    name: string;
    email: string;
    role: string;
    profileId: string | null;
    hierarchyRoleId: string | null;
    managerId: string | null;
    isActive: boolean;
    isCloser: boolean;
  };
  profiles: Option[];
  roles: Option[];
  managers: Option[];
  userId?: string;
}) {
  const router = useRouter();
  const isEdit = !!userId;

  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(initial?.role ?? "SALES_REP");
  const [profileId, setProfileId] = useState<string>(initial?.profileId ?? "");
  const [hierarchyRoleId, setHierarchyRoleId] = useState<string>(initial?.hierarchyRoleId ?? "");
  const [managerId, setManagerId] = useState<string>(initial?.managerId ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isCloser, setIsCloser] = useState(initial?.isCloser ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setJustSaved(false);
    setError(null);

    const body: Record<string, unknown> = {
      name, email, role,
      profileId: profileId || null,
      hierarchyRoleId: hierarchyRoleId || null,
      managerId: managerId || null,
      isActive,
      isCloser,
    };
    if (password) body.password = password;
    if (!isEdit && !password) {
      setError("Password is required for new users");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(
        isEdit ? `/api/users/${userId}` : "/api/users",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save user");
      // Unblock the button immediately — the write is done. Then do ONE
      // navigation per path (the old code did push + refresh, two full
      // server re-renders, which kept "Saving…" lit the whole time).
      setSubmitting(false);
      setJustSaved(true);
      if (isEdit) {
        router.refresh(); // already on this page; just re-pull fresh data in the background
      } else {
        router.push(`/settings/users/${data.id}`); // land on the new user's page
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save user");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} onChange={() => justSaved && setJustSaved(false)}>
      <header style={{
        background: "#fff", padding: "12px 20px", border: "1px solid #d8dde6",
        borderRadius: 4, marginBottom: 12,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <Link href="/settings/users" style={{ fontSize: 12, color: "#1589ee", textDecoration: "none" }}>
            ← Users
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: "4px 0 0", color: "#080707" }}>
            {isEdit ? `Edit ${initial?.name}` : "New User"}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="slds-button slds-button_neutral"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="slds-button slds-button_brand"
          disabled={submitting}
        >
          {submitting ? "Saving…" : justSaved ? "Saved ✓" : "Save"}
        </button>
      </header>

      {error && (
        <div style={{
          background: "#feded2", color: "#8e1f0b", padding: 10, borderRadius: 4,
          marginBottom: 12, border: "1px solid #f3aaa1", fontSize: 13,
        }}>
          {error}
        </div>
      )}

      <Section title="Account Info">
        <FieldGrid
          fields={[
            ["Name *", <input key="n" required value={name} onChange={(e) => setName(e.target.value)} className="slds-input" style={inputStyle} />],
            ["Email *", <input key="e" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="slds-input" style={inputStyle} />],
            [
              isEdit ? "New Password (leave blank to keep current)" : "Password *",
              <input key="p" type="password" required={!isEdit} value={password} onChange={(e) => setPassword(e.target.value)} className="slds-input" style={inputStyle} minLength={8} />,
            ],
            [
              "Active",
              <label key="a" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                User can sign in
              </label>,
            ],
            [
              "Closer",
              <label key="c" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={isCloser} onChange={(e) => setIsCloser(e.target.checked)} />
                Show the phone dialer for this user
              </label>,
            ],
          ]}
        />
      </Section>

      <Section title="Access & Reporting">
        <FieldGrid
          fields={[
            [
              "Profile",
              <select key="prof" value={profileId} onChange={(e) => setProfileId(e.target.value)} style={inputStyle}>
                <option value="">— Select a profile —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.label ?? p.name}</option>
                ))}
              </select>,
            ],
            [
              "Hierarchy Role",
              <select key="hr" value={hierarchyRoleId} onChange={(e) => setHierarchyRoleId(e.target.value)} style={inputStyle}>
                <option value="">— Select a role —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>,
            ],
            [
              "Manager",
              <select key="m" value={managerId} onChange={(e) => setManagerId(e.target.value)} style={inputStyle}>
                <option value="">— No manager —</option>
                {managers.filter((m) => m.id !== userId).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>,
            ],
            [
              "Legacy Role (string)",
              <select key="rs" value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="SALES_REP">Sales Rep</option>
                <option value="CS_REP">CS Rep</option>
                <option value="NEGOTIATOR">Negotiator</option>
              </select>,
            ],
          ]}
        />
      </Section>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  border: "1px solid #d8dde6",
  borderRadius: 4,
  fontSize: 13,
  background: "#fff",
};
