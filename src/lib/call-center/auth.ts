import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, loadEffectivePermissions } from "@/lib/permissions";

export async function requireVoiceSession(permission = "Call.Log") {
  const result = await requireAuthOrRespond();
  if ("response" in result) return result;
  const current = await prisma.user.findUnique({
    where: { id: result.session.userId },
    select: { isActive: true, role: true },
  });
  if (!current?.isActive)
    return {
      response: NextResponse.json(
        { error: "Account is inactive" },
        { status: 403 },
      ),
    };
  const permissions = [
    ...(await loadEffectivePermissions(result.session.userId)),
  ];
  if (!hasPermission(permissions, permission))
    return {
      response: NextResponse.json(
        { error: "Calling permission is required" },
        { status: 403 },
      ),
    };
  return { session: { ...result.session, role: current.role, permissions } };
}
