import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { loadEffectivePermissions } from "@/lib/permissions";
import { callingAccess, type CallCenterScreen } from "./access";

export async function requireCallCenterPage(screen?: CallCenterScreen) {
  const session = await requireAuth();
  const [user, permissions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { isActive: true, role: true, isCloser: true, closerTier: true },
    }),
    loadEffectivePermissions(session.userId),
  ]);
  if (!user?.isActive) redirect("/login");
  const access = callingAccess(user, [...permissions]);
  if (access.home === "/dashboard" || (screen && !access[screen]))
    redirect(access.home);
  return access;
}
