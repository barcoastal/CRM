"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

const CHANGE_KEY = "crm:user-preview-change";

async function changePreview(body: { action: "start" | "stop"; userId?: string }) {
  const response = await fetch("/api/admin/user-preview", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not change user preview");
  // A full navigation discards cached records, phone state and unsaved forms.
  // Other CRM tabs share the session, so make them reload the new identity too.
  try { localStorage.setItem(CHANGE_KEY, String(Date.now())); } catch { /* storage may be disabled */ }
  window.location.assign(result.href);
}

export function ViewAsUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [busy, setBusy] = useState(false);
  return <button type="button" className="slds-button slds-button_neutral" disabled={busy}
    aria-label={`View as ${userName}`} onClick={async () => {
      setBusy(true);
      try { await changePreview({ action: "start", userId }); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Could not start preview"); setBusy(false); }
    }}>{busy ? "Opening…" : "View as user"}</button>;
}

export function UserPreviewBanner() {
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === CHANGE_KEY) window.location.reload();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  if (!session?.impersonation) return null;
  return <aside className="crm-user-preview" aria-label="User preview" role="status">
    <span><strong>Viewing as {session.user.name}</strong> · {session.user.profileName ?? session.user.role} · Read-only
      {session.impersonation.unavailable && " · This preview is no longer available"}
    </span>
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await changePreview({ action: "stop" }); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Could not leave preview"); setBusy(false); }
    }}>{busy ? "Returning…" : "Return to admin"}</button>
  </aside>;
}
