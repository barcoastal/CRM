import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, PermissionDeniedError } from "@/lib/permissions";

export interface AuthedSession {
  userId: string;
  email: string;
  permissions: string[];
  role: string;
  profileName: string | null;
}

/**
 * Use inside API route handlers. Returns { session } on success or { response } when not authed.
 * If `required` is provided, also enforces the permission and returns 403 when missing.
 *
 * Example:
 *   const r = await requireAuthOrRespond("Lead.Edit");
 *   if ("response" in r) return r.response;
 *   const { session } = r;
 */
export async function requireAuthOrRespond(required?: string): Promise<{ session: AuthedSession } | { response: NextResponse }> {
  const s = await auth();
  if (!s?.user?.id) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const session: AuthedSession = {
    userId: s.user.id,
    email: s.user.email,
    permissions: s.user.permissions ?? [],
    role: s.user.role,
    profileName: s.user.profileName,
  };
  if (required && !hasPermission(session.permissions, required)) {
    return { response: NextResponse.json({ error: "Forbidden", required }, { status: 403 }) };
  }
  return { session };
}

/**
 * Throwing variant for places where you'd rather use try/catch.
 */
export async function requireAuth(required?: string): Promise<AuthedSession> {
  const s = await auth();
  if (!s?.user?.id) throw new Error("Unauthorized");
  const session: AuthedSession = {
    userId: s.user.id,
    email: s.user.email,
    permissions: s.user.permissions ?? [],
    role: s.user.role,
    profileName: s.user.profileName,
  };
  if (required && !hasPermission(session.permissions, required)) {
    throw new PermissionDeniedError(required);
  }
  return session;
}
