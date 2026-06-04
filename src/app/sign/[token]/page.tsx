import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SignClient } from "./sign-client";

/**
 * Public e-signature page. No auth — anyone with the signing token can
 * view + sign the envelope. The token is generated on Envelope creation
 * and is the only secret needed.
 */
export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const envelope = await prisma.envelope.findUnique({
    where: { signingToken: token },
    select: {
      id: true,
      status: true,
      signerName: true,
      signerEmail: true,
      templateName: true,
      documentName: true,
      documentUrl: true,
      sentAt: true,
      signedAt: true,
      completedAt: true,
      expiresAt: true,
    },
  });

  if (!envelope) notFound();

  const isVoided = envelope.status === "VOIDED" || envelope.status === "DECLINED";
  const isExpired = envelope.expiresAt ? envelope.expiresAt < new Date() : false;
  const isAlreadySigned = envelope.status === "COMPLETED";

  return (
    <div style={{ background: "#f4f6f9", minHeight: "100vh", padding: 0 }}>
      <header
        style={{
          background: "#fff",
          padding: "16px 24px",
          borderBottom: "1px solid #d8dde6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#706e6b", textTransform: "uppercase", letterSpacing: 0.4 }}>
            {envelope.templateName ?? "Document"}
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{envelope.documentName}</h1>
        </div>
        <div style={{ fontSize: 12, color: "#706e6b", textAlign: "right" }}>
          <div>Signer: {envelope.signerName}</div>
          <div>{envelope.signerEmail}</div>
        </div>
      </header>

      <div style={{ maxWidth: 980, margin: "24px auto", padding: "0 24px" }}>
        {isVoided && (
          <Banner color="#c23934">
            This envelope has been {envelope.status.toLowerCase()}. No further action is possible.
          </Banner>
        )}
        {isExpired && !isVoided && (
          <Banner color="#c23934">This link has expired. Please contact the sender for a new link.</Banner>
        )}
        {isAlreadySigned && (
          <Banner color="#04844b">
            ✓ Signed on {envelope.completedAt?.toLocaleString()}. Thank you!
          </Banner>
        )}

        {!isVoided && !isExpired && !isAlreadySigned && (
          <SignClient
            token={token}
            envelopeId={envelope.id}
            signerName={envelope.signerName}
            documentUrl={envelope.documentUrl ?? null}
          />
        )}
      </div>

      <footer
        style={{
          marginTop: 48,
          padding: 16,
          textAlign: "center",
          fontSize: 11,
          color: "#706e6b",
        }}
      >
        Powered by Coastal CRM e-Signature · This electronic signature is legally binding under the
        U.S. ESIGN Act and UETA.
      </footer>
    </div>
  );
}

function Banner({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${color}`,
        borderLeft: `4px solid ${color}`,
        padding: 16,
        borderRadius: 4,
        fontSize: 13,
        color: "#080707",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}
