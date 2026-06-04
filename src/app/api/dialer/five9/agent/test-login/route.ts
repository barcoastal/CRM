/**
 * Test Five9 agent credentials without starting a session.
 *
 *   POST /api/dialer/five9/agent/test-login
 *     body: { five9Username, five9Password }       — test ad-hoc creds
 *     OR no body                                   — test the saved creds
 *
 *   → { ok, error?, apiHost? }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { testCredentials, decryptPassword } from "@/lib/five9/agent-api";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    five9Username?: string;
    five9Password?: string;
  };

  let username = body.five9Username;
  let password = body.five9Password;

  if (!username || !password) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { five9Username: true, five9PasswordEnc: true },
    });
    if (!user?.five9Username || !user.five9PasswordEnc) {
      return NextResponse.json({ ok: false, error: "No saved credentials" }, { status: 400 });
    }
    username = user.five9Username;
    try {
      password = decryptPassword(user.five9PasswordEnc);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Stored password cannot be decrypted (FIVE9_AGENT_KEY changed?) — re-enter credentials" },
        { status: 500 },
      );
    }
  }

  const result = await testCredentials(username, password);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
