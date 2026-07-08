"use client";

/**
 * Per-route error boundary for /leads/[id]. Shows the runtime error inline so
 * pixel-parity / SF-port debugging can identify which sub-component crashed
 * the page render. Production builds normally hide the message — we surface
 * the digest + message here behind a discreet warning banner.
 */
export default function LeadDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        padding: 24,
        background: "#fff",
        border: "1px solid #ba0517",
        borderRadius: 4,
        margin: 16,
        fontFamily:
          'SalesforceSans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "#ba0517", marginBottom: 8 }}>
        Lead Detail render error
      </h1>
      <p style={{ fontSize: 13, color: "#444444", marginBottom: 4 }}>
        <strong>Message:</strong> {error.message || "(empty)"}
      </p>
      {error.digest && (
        <p style={{ fontSize: 13, color: "#444444", marginBottom: 4 }}>
          <strong>Digest:</strong> {error.digest}
        </p>
      )}
      {error.stack && (
        <pre
          style={{
            fontSize: 11,
            background: "#fafaf9",
            border: "1px solid #c9c9c9",
            borderRadius: 4,
            padding: 12,
            marginTop: 12,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "#181818",
          }}
        >
          {error.stack}
        </pre>
      )}
      <button
        onClick={reset}
        style={{
          marginTop: 12,
          background: "#0176d3",
          color: "#fff",
          border: 0,
          borderRadius: 4,
          padding: "6px 12px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}
