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
        border: "1px solid #d8dde6",
        borderRadius: 4,
        padding: 16,
        marginBottom: 8,
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#080707", margin: 0 }}>
          Escrow Balance
        </h3>
        {accountId && (
          <button
            onClick={refresh}
            disabled={refreshing}
            title="Pull live balance from payment processor"
            style={{
              background: "transparent",
              border: 0,
              cursor: refreshing ? "wait" : "pointer",
              color: "#0070d2",
              fontSize: 14,
            }}
          >
            {refreshing ? "⟳" : "↻"}
          </button>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#04844b" }}>
        ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      {pulledAt && (
        <div style={{ fontSize: 11, color: "#706e6b", marginTop: 6 }}>
          (Pulled on: {pulledAt.toLocaleString()})
        </div>
      )}
      {feePaidInFull && (
        <div
          style={{
            marginTop: 12,
            display: "inline-block",
            padding: "4px 12px",
            background: "#ddf5d6",
            color: "#0b683b",
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          ✓ Fee paid in full
        </div>
      )}
    </article>
  );
}
