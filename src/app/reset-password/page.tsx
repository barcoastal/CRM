"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Password updated — welcome to Coastal CRM");
        router.push("/");
        router.refresh();
      } else {
        toast.error(data.error ?? "Reset failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f3f3" }}>
      <form onSubmit={submit} style={{ background: "#fff", padding: 32, borderRadius: 8, width: 380, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Set your password</h1>
        <p style={{ color: "#706e6b", fontSize: 13, marginBottom: 20 }}>
          You're using a temporary password. Pick a new one to continue.
        </p>

        <label style={{ display: "block", fontSize: 11, color: "#706e6b", marginBottom: 4 }}>New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          style={{ width: "100%", padding: "8px 12px", border: "1px solid #d8dde6", borderRadius: 4, marginBottom: 12, boxSizing: "border-box" }}
        />

        <label style={{ display: "block", fontSize: 11, color: "#706e6b", marginBottom: 4 }}>Confirm password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          style={{ width: "100%", padding: "8px 12px", border: "1px solid #d8dde6", borderRadius: 4, marginBottom: 16, boxSizing: "border-box" }}
        />

        <button
          type="submit"
          disabled={busy}
          style={{ width: "100%", background: "#0070d2", color: "#fff", padding: "10px", borderRadius: 4, fontWeight: 600, border: 0, cursor: busy ? "wait" : "pointer", fontSize: 14 }}
        >
          {busy ? "Saving…" : "Set Password"}
        </button>
      </form>
    </div>
  );
}
