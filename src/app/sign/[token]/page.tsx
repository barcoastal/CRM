import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SignClient } from "./sign-client";
import styles from "@/components/esign/signing.module.css";

type Box = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
};

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const envelope = await prisma.envelope.findUnique({
    where: { signingToken: token },
    select: {
      id: true,
      packet: { select: { config: true } },
      createdBy: { select: { name: true } },
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

  if (envelope.status === "DRAFT")
    return (
      <TerminalView
        title="Waiting for your turn"
        body="You will receive an invitation when it is your turn to sign."
      />
    );

  const isTerminal =
    envelope.status === "VOIDED" || envelope.status === "DECLINED";
  const isExpired = envelope.expiresAt
    ? envelope.expiresAt < new Date()
    : false;
  const isCompleted = envelope.status === "COMPLETED";

  if (isTerminal) {
    return (
      <TerminalView
        title={
          envelope.status === "DECLINED"
            ? "Document declined"
            : "Document withdrawn"
        }
        body={
          envelope.voidReason ||
          (envelope.status === "DECLINED"
            ? "This document was declined. The sender has been notified."
            : "This document was withdrawn by the sender and is no longer active.")
        }
      />
    );
  }

  if (isExpired && !isCompleted) {
    return (
      <TerminalView
        title="This link has expired"
        body="Please reach out to the sender for a fresh signing link."
      />
    );
  }

  if (isCompleted) {
    const signedAt = envelope.completedAt?.toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    });
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
      senderName={envelope.createdBy?.name ?? "Coastal Debt Resolve"}
      message={
        (envelope.packet?.config as { message?: string } | undefined)?.message
      }
      documents={
        (
          envelope.packet?.config as
            | {
                documents?: {
                  name: string;
                  startPage: number;
                  pageCount: number;
                }[];
              }
            | undefined
        )?.documents
      }
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
    <div className={styles.welcome}>
      <div className={`${styles.welcomeCard} ${styles.success}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/email/coastal-logo.png"
          alt="Coastal Debt Resolve"
          width={220}
          style={{ maxWidth: "100%", height: "auto", margin: "0 auto" }}
        />
        {downloadHref && (
          <div className={styles.successIcon} aria-hidden="true">
            ✓
          </div>
        )}
        <div className={styles.completionEyebrow}>Coastal Sign</div>
        <h1>{title}</h1>
        <p>{body}</p>
        {downloadHref && (
          <div className={styles.successActions}>
            <a
              className={styles.primary}
              href={downloadHref}
              target="_blank"
              rel="noopener"
            >
              Download signed copy
            </a>
            <a
              className={styles.successRecord}
              href={downloadHref.replace("/signed-pdf", "/evidence")}
            >
              Download signing record
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
