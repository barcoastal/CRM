export function EscrowBalanceCard({
  balance,
  pulledAt,
  feePaidInFull,
}: {
  balance: number;
  pulledAt: Date | null;
  feePaidInFull: boolean;
}) {
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
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#080707" }}>
        Escrow Balance
      </h3>
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
