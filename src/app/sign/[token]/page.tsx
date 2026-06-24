import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SignClient } from "./sign-client";

type Box = { page: number; x: number; y: number; width: number; height: number; label?: string };

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
      signatureBoxes: true,
      initialBoxes: true,
      dateBoxes: true,
      textBoxes: true,
      checkboxBoxes: true,
      sentAt: true,
      signedAt: true,
      completedAt: true,
      expiresAt: true,
      voidReason: true,
    },
  });

  if (!envelope) notFound();

  if (envelope.status === "SENT") {
    const hdrs = await headers();
    const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || hdrs.get("x-real-ip") || null;
    const ua = hdrs.get("user-agent") ?? null;
    await prisma.$transaction([
      prisma.envelope.update({
        where: { id: envelope.id },
        data: { status: "VIEWED", viewedAt: new Date() },
      }),
      prisma.envelopeEvent.create({
        data: { envelopeId: envelope.id, eventType: "VIEWED", ipAddress: ip, userAgent: ua },
      }),
    ]);
  }

  const isTerminal = envelope.status === "VOIDED" || envelope.status === "DECLINED";
  const isExpired = envelope.expiresAt ? envelope.expiresAt < new Date() : false;
  const isCompleted = envelope.status === "COMPLETED";

  if (isTerminal) {
    return (
      <TerminalView
        title={envelope.status === "DECLINED" ? "Document declined" : "Document withdrawn"}
        body={
          envelope.voidReason ||
          (envelope.status === "DECLINED"
            ? "This document was declined. The sender has been notified."
            : "This document was withdrawn by the sender and is no longer active.")
        }
      />
    );
  }

  if (isExpired) {
    return (
      <TerminalView
        title="This link has expired"
        body="Please reach out to the sender for a fresh signing link."
      />
    );
  }

  if (isCompleted) {
    const signedAt = envelope.completedAt?.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
    return (
      <TerminalView
        title="Document signed"
        body={`This document was signed on ${signedAt}. You can download the signed copy below.`}
        downloadHref={`/api/esign/envelopes/by-token/${token}/signed-pdf`}
      />
    );
  }

  return (
    <SignClient
      token={token}
      envelopeId={envelope.id}
      signerName={envelope.signerName}
      signerEmail={envelope.signerEmail}
      documentName={envelope.documentName}
      templateName={envelope.templateName ?? "Document"}
      signatureBoxes={(envelope.signatureBoxes as unknown as Box[]) ?? []}
      initialBoxes={(envelope.initialBoxes as unknown as Box[]) ?? []}
      dateBoxes={(envelope.dateBoxes as unknown as Box[]) ?? []}
      textBoxes={(envelope.textBoxes as unknown as Box[]) ?? []}
      checkboxBoxes={(envelope.checkboxBoxes as unknown as Box[]) ?? []}
    />
  );
}

function TerminalView({
  title,
  body,
  downloadHref,
}: {
  title: string;
  body: string;
  downloadHref?: string;
}) {
  return (
    <div style={{ background: "#f4f6f9", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 8, maxWidth: 480, padding: 32, textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#131b2e", marginBottom: 12 }}>{title}</h1>
        <p style={{ fontSize: 14, color: "#444656", lineHeight: 1.5, marginBottom: 24 }}>{body}</p>
        {downloadHref && (
          <a
            href={downloadHref}
            target="_blank"
            rel="noopener"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "#3052ff",
              color: "#fff",
              textDecoration: "none",
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Download signed copy
          </a>
        )}
        <p style={{ marginTop: 28, fontSize: 11, color: "#706e6b" }}>
          Coastal CRM e-Signature. Electronic signatures are legally binding under the U.S. ESIGN Act and UETA.
        </p>
      </div>
    </div>
  );
}
