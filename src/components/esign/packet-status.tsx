"use client";
import { useEffect, useState } from "react";
import styles from "./packet-wizard.module.css";
type Packet = {
  status: string;
  envelopes: {
    id: string;
    status: string;
    signerName: string;
    signerEmail: string;
    routingOrder: number;
    sentAt: string | null;
    completedAt: string | null;
    lastError: string | null;
    expiresAt: string | null;
  }[];
};
export function PacketStatus({ id, token }: { id: string; token?: string }) {
  async function download() {
    const response = await fetch(
      `/api/esign/packets/${id}/pdf${packet?.status === "COMPLETED" ? "?signed=true" : ""}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!response.ok) {
      setError(
        "Could not download. Reopen Coastal Sign if your session expired.",
      );
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "Coastal-Sign-packet.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const [packet, setPacket] = useState<Packet | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetch(`/api/esign/packets/${id}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.json())
        .then((p) => {
          if (active) {
            if (p.error) setError(p.error);
            else setPacket(p);
          }
        })
        .catch(() => {
          if (active) setError("Could not refresh packet status.");
        });
    void refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, token]);
  const [notice, setNotice] = useState("");
  const [resendAfter, setResendAfter] = useState(0);
  const canResend = packet?.status === "SENT" && packet.envelopes.some(e =>
    ["SENT", "VIEWED"].includes(e.status) && (!e.expiresAt || new Date(e.expiresAt) > new Date()));
  async function resendInvitation() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/esign/packets/${id}/resend`, {
        method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not resend invitation.");
      setResendAfter(Date.now() + 60000);
      setNotice("Invitation resent to the current signer.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not resend invitation."); }
    finally { setBusy(false); }
  }
  async function voidPacket() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/esign/packets/${id}/void`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setPacket((p) =>
        p
          ? {
              ...p,
              status: "VOIDED",
              envelopes: p.envelopes.map((e) =>
                ["DRAFT", "SENT", "VIEWED"].includes(e.status)
                  ? { ...e, status: "VOIDED" }
                  : e,
              ),
            }
          : p,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to void");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={styles.card}
      style={{ margin: "24px auto", maxWidth: 1100, textAlign: "left" }}
    >
      <div className={styles.cardHeader}>
        <h2>Packet status: {packet?.status ?? "Loading…"}</h2>
        <button onClick={download}>
          {packet?.status === "COMPLETED"
            ? "Download signed packet"
            : "Download documents"}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {canResend && <div style={{ padding: 20 }}><button disabled={busy || Date.now() < resendAfter} onClick={resendInvitation}>Resend invitation</button></div>}
      {packet?.envelopes
        .sort((a, b) => a.routingOrder - b.routingOrder)
        .map((e) => (
          <div className={styles.row} key={e.id}>
            <b>{e.routingOrder}</b>
            <div className={styles.grow}>
              <strong>{e.signerName}</strong>
              <small>{e.signerEmail}</small>
            </div>
            <span>
              {e.status === "DRAFT"
                ? "Waiting for earlier signer"
                : e.expiresAt &&
                    new Date(e.expiresAt) < new Date() &&
                    ["SENT", "VIEWED"].includes(e.status)
                  ? "EXPIRED"
                  : e.status}
            </span>
            <small>
              {e.completedAt
                ? new Date(e.completedAt).toLocaleString()
                : (e.lastError ?? "")}
            </small>
          </div>
        ))}
      {packet && ["SENT", "SENDING"].includes(packet.status) && (
        <details style={{ padding: 20 }}>
          <summary>Void this packet</summary>
          <p>
            Voiding stops remaining recipients from signing. Completed
            signatures are retained.
          </p>
          <input
            aria-label="Reason for voiding"
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button disabled={busy || !reason.trim()} onClick={voidPacket}>
            Void packet
          </button>
        </details>
      )}
    </section>
  );
}
