"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function EscrowBalanceCard({
  accountId,
  balance,
  pulledAt,
  feePaidInFull,
}: {
  accountId?: string;
  balance: number;
  pulledAt: Date | null;
  feePaidInFull: boolean;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    if (!accountId) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/refresh-escrow`, { method: "POST" });
      if (res.ok) {
        toast.success("Escrow refreshed");
        router.refresh();
      } else {
        const { error } = await res.json().catch(() => ({ error: "Refresh failed" }));
        toast.error(error ?? "Refresh failed");
      }
    } finally {
      setRefreshing(false);
    }
  }
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        marginBottom: 12,
        overflow: "hidden",
        boxShadow: "0 2px 2px 0 rgba(0,0,0,.05)",
      }}
    >
      <header
        style={{
          background: "#fafaf9",
          borderBottom: "1px solid #c9c9c9",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              background: "#0176d3",
              color: "#fff",
              borderRadius: 3,
              flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 52 52" style={{ fill: "#fff" }}>
              <path d="M30.4 26.5l-7.3-2c-1.3-.4-2.2-1.6-2.2-3 0-1.7 1.4-3.1 3.1-3.1H29c1.3 0 2.5.4 3.4 1.2.7.6 1.7.5 2.3-.1l1.4-1.4c.7-.7.6-1.8-.1-2.4-1.8-1.6-4.2-2.6-6.7-2.8V10c0-1.1-.9-2-2-2h-2.6c-1.1 0-2 .9-2 2v2.8c-4.4.3-7.9 4-7.8 8.4.1 3.8 2.9 7.1 6.6 8.1l6.9 1.9c1.3.4 2.2 1.6 2.2 3 0 1.7-1.4 3.1-3.1 3.1H23c-1.3 0-2.5-.4-3.4-1.2-.7-.6-1.7-.5-2.3.1L16 37.6c-.7.7-.6 1.8.1 2.4 1.8 1.6 4.2 2.6 6.7 2.8V46c0 1.1.9 2 2 2H27c1.1 0 2-.9 2-2v-2.8c4.4-.3 7.9-4 7.8-8.4 0-3.8-2.7-7.2-6.4-8.3z" />
            </svg>
          </span>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181818", margin: 0 }}>
            Escrow Balance
          </h3>
        </div>
        {accountId && (
          <button
            onClick={refresh}
            disabled={refreshing}
            title="Pull live balance from payment processor"
            style={{
              background: "transparent",
              border: 0,
              cursor: refreshing ? "wait" : "pointer",
              color: "#747474",
              fontSize: 14,
              padding: 2,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: 3,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 52 52" style={{ fill: "currentColor" }}>
              <path d="M26 9c-9.4 0-17 7.6-17 17 0 1.7.3 3.4.8 5l-3.5-2c-.4-.2-.9-.1-1.2.3l-1 1.5c-.3.4-.2.9.2 1.2l7 4.1c.5.3 1.1.1 1.4-.3l4.1-7c.3-.5.1-1.1-.3-1.4l-1.5-1c-.4-.3-.9-.2-1.2.2l-1.7 2.5c-.3-1.4-.4-2.7-.4-4.1 0-7.1 5.8-12.9 12.9-12.9 4.1 0 7.7 1.9 10.1 4.9.4.4 1 .5 1.4.1l1.5-1.3c.4-.4.4-1 0-1.4C36.2 11.6 31.4 9 26 9zm17.7 21.2l-7-4.1c-.5-.3-1.1-.1-1.4.3l-4.1 7c-.3.5-.1 1.1.3 1.4l1.5 1c.4.3 1 .2 1.2-.2l1.6-2.4c.3 1.3.4 2.5.4 3.8 0 7.1-5.8 12.9-12.9 12.9-4.1 0-7.7-1.9-10.1-4.9-.4-.4-1-.5-1.4-.1l-1.5 1.3c-.4.4-.4 1 0 1.4 3 3.7 7.8 6.3 13.2 6.3 9.4 0 17-7.6 17-17 0-1.7-.3-3.4-.8-4.9l3.5 2c.4.2.9.1 1.2-.3l1-1.5c.4-.4.3-1-.1-1.2z" />
            </svg>
          </button>
        )}
      </header>
      <div style={{ padding: "20px 16px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#04844b" }}>
          ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {pulledAt && (
          <div style={{ fontSize: 11, color: "#747474", marginTop: 6 }}>
            (Pulled on: {pulledAt.toLocaleString()})
          </div>
        )}
        {feePaidInFull && (
          <div
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              background: "#04844b",
              color: "#fff",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12l5 5L20 7" />
            </svg>
            Fee paid in full
          </div>
        )}
      </div>
    </article>
  );
}
