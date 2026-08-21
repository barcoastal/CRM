import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CloserTiersManager, type TierUser } from "@/components/settings/closer-tiers-manager";

export const dynamic = "force-dynamic";

export default async function CloserTiersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [config, users] = await Promise.all([
    prisma.closerTierConfig.findUnique({ where: { id: "singleton" } }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, isCloser: true, closerTier: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <header style={{ background: "#fff", padding: "16px 24px", border: "1px solid #c9c9c9", borderRadius: 4, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "#747474", marginBottom: 4 }}>
          <Link href="/settings" style={{ color: "#0176d3", textDecoration: "none" }}>Setup</Link> / Closer Tiers
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#181818", margin: 0 }}>Closer Tiers</h1>
        <p style={{ fontSize: 13, color: "#747474", marginTop: 4 }}>
          Assign closers to tiers and set the debt cutoffs that decide which tier takes a transfer.
        </p>
      </header>

      <CloserTiersManager
        initialTier1Max={config?.tier1Max ?? 100_000}
        initialTier2Max={config?.tier2Max ?? 250_000}
        users={users as TierUser[]}
      />
    </div>
  );
}
