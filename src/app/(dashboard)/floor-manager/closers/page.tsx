import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CloserTiersManager } from "@/components/settings/closer-tiers-manager";

export const dynamic = "force-dynamic";

export default async function CloserSetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const canEdit = hasPermission(session.user.permissions ?? [], "Setup.Admin");
  const [config, users] = await Promise.all([
    prisma.closerTierConfig.findUnique({ where: { id: "singleton" } }),
    prisma.user.findMany({
      where: { isActive: true, ...(!canEdit ? { OR: [{ isCloser: true }, { closerTier: { not: null } }] } : {}) },
      select: { id: true, name: true, email: true, isCloser: true, closerTier: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <CloserTiersManager
      initialTier1Max={config?.tier1Max ?? 100_000}
      initialTier2Max={config?.tier2Max ?? 250_000}
      users={users}
      canEdit={canEdit}
    />
  );
}
