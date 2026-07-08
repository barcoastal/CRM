"use client";

/**
 * Two thin actions for the envelope detail sidebar:
 *  - Copy signing link
 *  - Open the signer page in a new tab
 *
 * "Resend email" is intentionally NOT here yet. The existing /api/envelopes/
 * single-blob flow has its own /send route; chunk 3 will add an esign-specific
 * resend endpoint that re-uses the prepared blob without re-running the merge.
 */
import { toast } from "sonner";

export function ResendSigningLinkButton({
  envelopeId,
  signingUrl,
  status,
}: {
  envelopeId: string;
  signingUrl: string;
  status: string;
}) {
  async function copy() {
    const fullUrl = `${window.location.origin}${signingUrl}`;
    await navigator.clipboard.writeText(fullUrl);
    toast.success("Signing link copied");
  }

  const canResend = status === "SENT" || status === "VIEWED" || status === "DRAFT";

  return (
    <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
      <button onClick={copy} style={btn} disabled={!canResend}>Copy signing link</button>
      <a href={signingUrl} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: "none", display: "inline-block" }}>
        Open signer page
      </a>
      <span style={{ display: "none" }}>{envelopeId}</span>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #c9c9c9",
  color: "#0176d3",
  padding: "5px 12px",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
