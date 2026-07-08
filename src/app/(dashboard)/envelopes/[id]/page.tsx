/**
 * Envelope detail page: prepared PDF preview + status + event log.
 *
 * Server-rendered with a thin "Resend signing link" client button. The PDF
 * iframe loads from /api/esign/envelopes/:id/pdf which streams the prepared
 * (merged-but-not-signed) blob.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ResendSigningLinkButton } from "@/components/esign/resend-signing-link-button";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: "#ecebea", color: "#444444" },
  SENT: { bg: "#d4ecff", color: "#0a3b6f" },
  VIEWED: { bg: "#fff5d8", color: "#806c00" },
  SIGNED: { bg: "#ddf5d6", color: "#0b683b" },
  COMPLETED: { bg: "#ddf5d6", color: "#0b683b" },
  VOIDED: { bg: "#feded2", color: "#8e1f0b" },
  DECLINED: { bg: "#feded2", color: "#8e1f0b" },
};

export default async function EnvelopeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const envelope = await prisma.envelope.findUnique({
    where: { id },
    include: {
      template: { select: { id: true, name: true } },
      opportunity: { select: { id: true, name: true, account: { select: { name: true } } } },
      events: { orderBy: { createdAt: "desc" } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!envelope) notFound();

  const tone = STATUS_COLORS[envelope.status] ?? STATUS_COLORS.DRAFT;
  const signingUrl = `/sign/${envelope.signingToken}`;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 12, fontSize: 12, color: "#747474" }}>
        <Link href="/envelopes" style={{ color: "#0176d3" }}>Envelopes</Link>
        <span> / </span>
        <span>{envelope.documentName}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16 }}>
        <article style={{ background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4 }}>
          <header style={hdr}>
            <h2 style={{ fontSize: 14, margin: 0 }}>Document Preview</h2>
            <a href={`/api/esign/envelopes/${envelope.id}/pdf`} target="_blank" rel="noreferrer" style={linkBtn}>
              Open in new tab
            </a>
          </header>
          <iframe
            src={`/api/esign/envelopes/${envelope.id}/pdf`}
            style={{ width: "100%", height: 760, border: 0 }}
            title={envelope.documentName}
          />
        </article>

        <div>
          <article style={card}>
            <header style={hdr}>
              <h2 style={{ fontSize: 14, margin: 0 }}>Status</h2>
            </header>
            <div style={{ padding: 12 }}>
              <span style={{
                background: tone.bg,
                color: tone.color,
                padding: "3px 10px",
                borderRadius: 14,
                fontSize: 12,
                fontWeight: 700,
              }}>
                {envelope.status}
              </span>
              <dl style={{ marginTop: 12, fontSize: 12 }}>
                <Row label="Signer" value={`${envelope.signerName} <${envelope.signerEmail}>`} />
                {envelope.template && (
                  <Row label="Template" value={<Link href={`/templates/esign/${envelope.template.id}`} style={{ color: "#0176d3" }}>{envelope.template.name}</Link>} />
                )}
                {envelope.opportunity && (
                  <Row label="Opportunity" value={
                    <Link href={`/opportunities/${envelope.opportunity.id}`} style={{ color: "#0176d3" }}>
                      {envelope.opportunity.name ?? envelope.opportunity.account?.name ?? envelope.opportunity.id.slice(-6)}
                    </Link>
                  } />
                )}
                <Row label="Sent" value={envelope.sentAt ? envelope.sentAt.toLocaleString() : ""} />
                <Row label="Signed" value={envelope.signedAt ? envelope.signedAt.toLocaleString() : ""} />
                <Row label="Created" value={`${envelope.createdAt.toLocaleString()}${envelope.createdBy?.name ? ` by ${envelope.createdBy.name}` : ""}`} />
              </dl>
              <ResendSigningLinkButton envelopeId={envelope.id} signingUrl={signingUrl} status={envelope.status} />
            </div>
          </article>

          <article style={{ ...card, marginTop: 12 }}>
            <header style={hdr}>
              <h2 style={{ fontSize: 14, margin: 0 }}>Events ({envelope.events.length})</h2>
            </header>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {envelope.events.length === 0 ? (
                <li style={{ padding: 12, fontSize: 12, color: "#747474" }}>No events.</li>
              ) : (
                envelope.events.map((ev) => (
                  <li key={ev.id} style={{ padding: "10px 12px", borderTop: "1px solid #f3f3f3", fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{ev.eventType}</div>
                    <div style={{ color: "#747474" }}>{ev.createdAt.toLocaleString()}</div>
                    {ev.details && <div style={{ marginTop: 4 }}>{ev.details}</div>}
                  </li>
                ))
              )}
            </ul>
          </article>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 6, padding: "4px 0" }}>
      <dt style={{ color: "#747474" }}>{label}</dt>
      <dd style={{ margin: 0, color: "#181818", wordBreak: "break-word" }}>{value || <span style={{ color: "#aaa" }}>--</span>}</dd>
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid #c9c9c9", borderRadius: 4 };
const hdr: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  borderBottom: "1px solid #ecebea",
};
const linkBtn: React.CSSProperties = {
  fontSize: 12,
  color: "#0176d3",
  textDecoration: "none",
};
