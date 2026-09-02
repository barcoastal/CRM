"use client";

/**
 * Admin control for Gmail mailbox sync: enable/disable per rep, bulk-enable all,
 * and trigger an immediate sync. Salesforce Einstein Activity Capture style.
 */
import { useCallback, useEffect, useState } from "react";

interface Row {
  id: string;
  name: string;
  email: string;
  gmailSync: { status: string; lastSyncedAt: string | null; lastError: string | null; syncedCount: number } | null;
}

export function GmailSyncClient({ configured }: { configured: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/email-center/gmail/mailboxes");
    const data = await res.json().catch(() => ({ items: [] }));
    setRows(data.items ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load flips loading before fetching, matching the app pattern
    void load();
  }, [load]);

  async function toggle(row: Row, enabled: boolean) {
    setBusy(row.id);
    await fetch(`/api/email-center/gmail/mailboxes/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    await load();
    setBusy(null);
  }
  async function syncNow(row: Row) {
    setBusy(row.id);
    await fetch(`/api/email-center/gmail/mailboxes/${row.id}`, { method: "POST" });
    await load();
    setBusy(null);
  }
  async function bulkEnable() {
    setBusy("bulk");
    await fetch("/api/email-center/gmail/mailboxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bulkEnableAll: true }) });
    await load();
    setBusy(null);
  }
  async function syncAll() {
    const active = rows.filter((row) => row.gmailSync?.status === "ACTIVE");
    if (active.length === 0) return;
    setBusy("syncall");
    setSyncProgress({ done: 0, total: active.length });
    for (let i = 0; i < active.length; i++) {
      await fetch(`/api/email-center/gmail/mailboxes/${active[i].id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full: true }),
      }).catch(() => undefined);
      setSyncProgress({ done: i + 1, total: active.length });
    }
    setSyncProgress(null);
    await load();
    setBusy(null);
  }

  return (
    <div className="ec-flows-wrap">
      <div className="ec-flows-head">
        <div>
          <h1 className="ec-flows-title">Mailbox Sync</h1>
          <p className="ec-flows-sub">Connect reps&apos; Google mailboxes so their email flows into the CRM. All mail is captured; each message links to a lead, contact, or account when the address matches one.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="ec-btn"
            disabled={!configured || busy !== null || rows.every((row) => row.gmailSync?.status !== "ACTIVE")}
            onClick={() => void syncAll()}
          >
            {busy === "syncall" && syncProgress ? `Syncing ${syncProgress.done}/${syncProgress.total}...` : "Sync all reps now"}
          </button>
          <button className="ec-btn ec-btn-primary" disabled={busy === "bulk"} onClick={() => void bulkEnable()}>Enable all reps</button>
        </div>
      </div>
      {!configured ? (
        <div className="ec-pill ec-pill-amber" style={{ marginBottom: 14 }}>
          Google service account not configured yet. Set GOOGLE_SA_CLIENT_EMAIL and GOOGLE_SA_PRIVATE_KEY to start syncing.
        </div>
      ) : null}
      {loading ? (
        <div className="ec-empty" style={{ paddingTop: 40 }}><div className="ec-empty-sub">Loading...</div></div>
      ) : (
        <div className="ec-flows-list" style={{ maxWidth: 920 }}>
          {rows.map((row) => {
            const on = row.gmailSync?.status === "ACTIVE";
            const err = row.gmailSync?.status === "ERROR";
            return (
              <div key={row.id} className="ec-flow-row">
                <button className={`ec-switch${on ? " ec-switch-on" : ""}`} disabled={busy === row.id} onClick={() => void toggle(row, !on)}>
                  <span className="ec-switch-knob" />
                </button>
                <span className="ec-flow-main">
                  <span className="ec-flow-name">{row.name}</span>
                  <span className="ec-flow-desc">{row.email}{row.gmailSync?.lastSyncedAt ? ` · last synced ${new Date(row.gmailSync.lastSyncedAt).toLocaleString()}` : ""}{err && row.gmailSync?.lastError ? ` · error: ${row.gmailSync.lastError.slice(0, 60)}` : ""}</span>
                </span>
                {row.gmailSync?.syncedCount ? <span className="ec-pill ec-pill-neutral">{row.gmailSync.syncedCount} synced</span> : null}
                <span className={`ec-pill ${err ? "ec-pill-danger" : on ? "ec-pill-live" : "ec-pill-neutral"}`}>{err ? "error" : on ? "on" : "off"}</span>
                {on ? <button className="ec-btn ec-btn-ghost" disabled={busy === row.id} onClick={() => void syncNow(row)}>Sync now</button> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
