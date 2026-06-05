/**
 * Authenticated password reset — the user is logged in (with the temp
 * password) and must pick a new one before they can use the app.
 *
 *   POST /api/auth/reset-password  { newPassword }
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { newPassword?: string };
  const newPassword = body.newPassword ?? "";
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: hash, mustResetPassword: false },
  });

  return NextResponse.json({ ok: true });
}
