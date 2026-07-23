export function HealthCheckCard({
  welcomeCallCompleted,
  firstPaymentReceived,
}: {
  welcomeCallCompleted: boolean;
  firstPaymentReceived: boolean;
}) {
  const items = [
    { label: welcomeCallCompleted ? "Welcome Call completed" : "Welcome Call Not completed", ok: welcomeCallCompleted },
    { label: firstPaymentReceived ? "First Payment Received" : "First Payment Not Received", ok: firstPaymentReceived },
  ];
  const allOk = items.every((i) => i.ok);
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #c9c9c9",
        borderRadius: 4,
        marginBottom: 8,
        overflow: "hidden",
        boxShadow: "0 2px 2px 0 rgba(0,0,0,.05)",
      }}
    >
      {/* SF: collapse chevron | state icon (green when passing) | title, refresh at right */}
      <header
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#747474" strokeWidth="2.5" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: allOk ? "#2e844a" : "#ba0517",
            flexShrink: 0,
          }}
        >
          {allOk ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
              <path d="M5 12l5 5L20 7" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff">
              <rect x="10.5" y="5" width="3" height="10" rx="1.5" />
              <circle cx="12" cy="18.5" r="1.8" />
            </svg>
          )}
        </span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181818", margin: 0, flex: 1 }}>
          Health Check Results
        </h3>
        <svg width="14" height="14" viewBox="0 0 52 52" style={{ fill: "#747474", flexShrink: 0 }} aria-hidden="true">
          <path d="M26 9c-9.4 0-17 7.6-17 17 0 1.7.3 3.4.8 5l-3.5-2c-.4-.2-.9-.1-1.2.3l-1 1.5c-.3.4-.2.9.2 1.2l7 4.1c.5.3 1.1.1 1.4-.3l4.1-7c.3-.5.1-1.1-.3-1.4l-1.5-1c-.4-.3-.9-.2-1.2.2l-1.7 2.5c-.3-1.4-.4-2.7-.4-4.1 0-7.1 5.8-12.9 12.9-12.9 4.1 0 7.7 1.9 10.1 4.9.4.4 1 .5 1.4.1l1.5-1.3c.4-.4.4-1 0-1.4C36.2 11.6 31.4 9 26 9zm17.7 21.2l-7-4.1c-.5-.3-1.1-.1-1.4.3l-4.1 7c-.3.5-.1 1.1.3 1.4l1.5 1c.4.3 1 .2 1.2-.2l1.6-2.4c.3 1.3.4 2.5.4 3.8 0 7.1-5.8 12.9-12.9 12.9-4.1 0-7.7-1.9-10.1-4.9-.4-.4-1-.5-1.4-.1l-1.5 1.3c-.4.4-.4 1 0 1.4 3 3.7 7.8 6.3 13.2 6.3 9.4 0 17-7.6 17-17 0-1.7-.3-3.4-.8-4.9l3.5 2c.4.2.9.1 1.2-.3l1-1.5c.4-.4.3-1-.1-1.2z" />
        </svg>
      </header>
      <ul style={{ listStyle: "none", padding: "0 16px 10px 32px", margin: 0 }}>
        {items.map((i) => (
          <li
            key={i.label}
            style={{
              fontSize: 13,
              padding: "4px 0",
              display: "flex",
              alignItems: "center",
              gap: 8,
              // SF items read in regular dark text; only the icon carries the state color.
              color: "#181818",
              fontWeight: 400,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: i.ok ? "#2e844a" : "#ba0517",
                flexShrink: 0,
              }}
            >
              {i.ok ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              ) : (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              )}
            </span>
            <span>{i.label}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
