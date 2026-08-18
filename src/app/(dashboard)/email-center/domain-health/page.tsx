import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { sendingDomain } from "@/lib/email/domain-health";
import { HealthClient } from "./health-client";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function DomainHealthPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  const domain = sendingDomain();
  const latest = await prisma.domainHealthSnapshot.findFirst({ where: { domain }, orderBy: { createdAt: "desc" } });
  return (
    <HealthClient
      domain={domain}
      isAdmin={ADMIN_ROLES.includes(me?.role ?? "")}
      initial={latest ? {
        spf: latest.spf, dkim: latest.dkim, dmarc: latest.dmarc,
        spfRecord: latest.spfRecord, dmarcRecord: latest.dmarcRecord,
        bounceRate: latest.bounceRate, complaintRate: latest.complaintRate, openRate: latest.openRate,
        score: latest.score, blacklists: (latest.blacklists as Array<{ zone: string; listed: boolean }>) ?? [],
        createdAt: latest.createdAt.toISOString(),
      } : null}
    />
  );
}
