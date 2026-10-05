"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function OpenerFrameLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) setError("Invalid email or password.");
      else router.refresh();
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f3f5f8", padding: 16, fontFamily: "Arial, sans-serif", color: "#181818" }}>
      <div style={{ background: "#fff", border: "1px solid #d8dde6", borderRadius: 8, padding: 18, maxWidth: 420, margin: "0 auto" }}>
        <strong style={{ fontSize: 16 }}>Coastal CRM</strong>
        <p style={{ color: "#64748b", fontSize: 13 }}>Sign in to work on the lead for your current Five9 call.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
            Email
            <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
            Password
            <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
          </label>
          {error && <p role="alert" style={{ margin: 0, color: "#ba1a1a", fontSize: 12 }}>{error}</p>}
          <button type="submit" disabled={busy} style={{ background: "#0176d3", color: "#fff", border: 0, borderRadius: 4, padding: 10, fontWeight: 700, cursor: "pointer" }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid #c9c9c9", borderRadius: 4, padding: "8px 10px", fontSize: 14 };
