/**
 * Save the current user's Five9 AgentREST credentials.
 *
 * PUT  /api/dialer/five9/agent/credentials
 *   { five9Username, five9Password, five9StationId? }
 *
 * GET  /api/dialer/five9/agent/credentials
 *   → { configured: boolean, five9Username?, five9StationId? }
 *   (never returns the password)
 *
 * Password is encrypted at rest with FIVE9_AGENT_KEY (AES-256-GCM).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptPassword } from "@/lib/five9/agent-api";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { five9Username: true, five9StationId: true, five9PasswordEnc: true },
  });
  return NextResponse.json({
    configured: !!(user?.five9Username && user.five9PasswordEnc),
    five9Username: user?.five9Username ?? null,
    five9StationId: user?.five9StationId ?? null,
  });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { five9Username?: string; five9Password?: string; five9StationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.five9Username || !body.five9Password) {
    return NextResponse.json({ error: "five9Username and five9Password required" }, { status: 400 });
  }

  const enc = encryptPassword(body.five9Password);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      five9Username: body.five9Username,
      five9PasswordEnc: enc,
      five9StationId: body.five9StationId ?? undefined,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.user.update({
    where: { id: session.user.id },
    data: { five9Username: null, five9PasswordEnc: null, five9StationId: null },
  });
  return NextResponse.json({ ok: true });
}
