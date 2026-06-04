import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/sign/[token] — public, fetch envelope by signing token. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const env = await prisma.envelope.findUnique({
    where: { signingToken: token },
    select: {
      id: true,
      status: true,
      signerName: true,
      signerEmail: true,
      templateName: true,
      documentName: true,
      documentUrl: true,
      pages: true,
      sentAt: true,
      viewedAt: true,
      signedAt: true,
      completedAt: true,
      expiresAt: true,
    },
  });
  if (!env) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  if (env.status === "VOIDED" || env.status === "DECLINED") {
    return NextResponse.json({ error: `Envelope ${env.status.toLowerCase()}` }, { status: 410 });
  }
  if (env.expiresAt && env.expiresAt < new Date()) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }
  return NextResponse.json(env);
}
