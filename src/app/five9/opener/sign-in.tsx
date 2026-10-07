"use client";

import { useEffect, useRef, useState } from "react";
import { SessionProvider, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type GoogleIdentity = {
  accounts: { id: {
    initialize(options: { client_id: string; callback: (response: { credential?: string }) => void }): void;
    renderButton(element: HTMLElement, options: { theme: string; size: string; width: number }): void;
  } };
};

declare global { interface Window { google?: GoogleIdentity } }

export function OpenerFrameLogin({ googleClientId }: { googleClientId?: string }) {
  return <SessionProvider basePath="/api/five9/auth"><OpenerFrameLoginForm googleClientId={googleClientId} /></SessionProvider>;
}

function OpenerFrameLoginForm({ googleClientId }: { googleClientId?: string }) {
  const router = useRouter();
  const googleButton = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!googleClientId) return;
    let disposed = false;
    const initialize = () => {
      if (disposed || !window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          if (!credential) return;
          setError("");
          setBusy(true);
          try {
            const result = await signIn("five9-google", { credential, redirect: false });
            if (result?.error) setError("This Google account is not enabled for the CRM pilot.");
            else router.refresh();
          } catch {
            setError("Google sign-in failed. Please try again.");
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButton.current, {
        theme: "outline", size: "large", width: 360,
      });
    };
    if (window.google) initialize();
    else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = initialize;
      script.onerror = () => { if (!disposed) setError("Google sign-in is unavailable in this tab."); };
      document.head.appendChild(script);
    }
    return () => { disposed = true; };
  }, [googleClientId, router]);

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
        {googleClientId && <div ref={googleButton} aria-label="Sign in with Google Workspace" style={{ minHeight: 42, marginBottom: 12 }} />}
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
