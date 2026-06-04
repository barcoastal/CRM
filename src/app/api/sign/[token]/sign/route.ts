import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeCtx, triggerUpdate } from "@/lib/triggers/runner";
import type { Envelope } from "@/generated/prisma/client";

/**
 * POST /api/sign/[token]/sign
 * Public endpoint — accepts the signature image + audit details and moves
 * the envelope through SIGNED → COMPLETED. The envelope trigger handles
 * downstream effects (Opportunity.bankChangeContractStatus, Account
 * firstContractSignedDate, Document creation).
 *
 * Body: { signatureImage: string (data URL), signerName?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const env = await prisma.envelope.findUnique({ where: { signingToken: token } });
  if (!env) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (env.status === "COMPLETED") return NextResponse.json({ ok: true, alreadySigned: true });
  if (env.status === "VOIDED" || env.status === "DECLINED") {
    return NextResponse.json({ error: `Envelope ${env.status.toLowerCase()}` }, { status: 410 });
  }
  if (env.expiresAt && env.expiresAt < new Date()) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }

  const body = await request.json().catch(() => ({}));
  const { signatureImage, signerName } = body ?? {};
  if (typeof signatureImage !== "string" || !signatureImage.startsWith("data:image/")) {
    return NextResponse.json({ error: "signatureImage (data URL) required" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = request.headers.get("user-agent") ?? null;

  const ctx = makeCtx(null);
  // We use the COMPLETED status to also trigger downstream effects.
  // The envelope trigger writes signedAt + completedAt via beforeUpdate stamps.
  await triggerUpdate<Envelope>(
    "envelope",
    env.id,
    {
      status: "COMPLETED",
      signatureImage,
      signatureIp: ip,
      signatureUserAgent: ua,
      signerName: signerName ?? env.signerName,
      // signedDocumentUrl — in a real product this would be a generated
      // composite PDF stored in S3. For now we just point back to the
      // original documentUrl and stash the signature image alongside.
      signedDocumentUrl: env.documentUrl ?? null,
    },
    ctx
  );

  return NextResponse.json({ ok: true });
}
