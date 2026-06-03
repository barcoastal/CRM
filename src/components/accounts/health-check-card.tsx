export function HealthCheckCard({
  welcomeCallCompleted,
  firstPaymentReceived,
}: {
  welcomeCallCompleted: boolean;
  firstPaymentReceived: boolean;
}) {
  const items = [
    { label: "Welcome Call Not completed", ok: welcomeCallCompleted },
    { label: "First Payment Received", ok: firstPaymentReceived },
  ];
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #d8dde6",
        borderRadius: 4,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 8,
          color: "#c23934",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            background: "#c23934",
            color: "#fff",
            borderRadius: "50%",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          !
        </span>
        Health Check Results
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((i) => (
          <li
            key={i.label}
            style={{
              fontSize: 12,
              padding: "4px 0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: i.ok ? "#04844b" : "#c23934",
            }}
          >
            <span>{i.ok ? "✓" : "✕"}</span>
            <span>{i.label}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
