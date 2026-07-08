export function HealthCheckCard({
  welcomeCallCompleted,
  firstPaymentReceived,
}: {
  welcomeCallCompleted: boolean;
  firstPaymentReceived: boolean;
}) {
  const items = [
    { label: welcomeCallCompleted ? "Welcome Call Completed" : "Welcome Call Not completed", ok: welcomeCallCompleted },
    { label: firstPaymentReceived ? "First Payment Received" : "First Payment Not Received", ok: firstPaymentReceived },
  ];
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
          gap: 8,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            background: "#c23934",
            color: "#fff",
            borderRadius: 3,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 52 52" style={{ fill: "#fff" }}>
            <path d="M26 0C11.6 0 0 11.6 0 26s11.6 26 26 26 26-11.6 26-26S40.4 0 26 0zm0 41c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3zm3-12c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2V13c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v16z" />
          </svg>
        </span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181818", margin: 0 }}>
          Health Check Results
        </h3>
      </header>
      <ul style={{ listStyle: "none", padding: "8px 16px", margin: 0 }}>
        {items.map((i) => (
          <li
            key={i.label}
            style={{
              fontSize: 13,
              padding: "6px 0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: i.ok ? "#04844b" : "#c23934",
              fontWeight: 600,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 14,
                height: 14,
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              {i.ok ? "✓" : "✕"}
            </span>
            <span>{i.label}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
