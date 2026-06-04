import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeCtx, triggerUpdate } from "@/lib/triggers/runner";
import type { Envelope } from "@/generated/prisma/client";

/** POST /api/sign/[token]/view — mark envelope as viewed. Public, no auth. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const env = await prisma.envelope.findUnique({ where: { signingToken: token } });
  if (!env) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (env.status !== "SENT") return NextResponse.json({ ok: true, alreadyViewed: true });

  const ctx = makeCtx(null);
  await triggerUpdate<Envelope>("envelope", env.id, { status: "VIEWED" }, ctx);
  return NextResponse.json({ ok: true });
}
