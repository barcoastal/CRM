import { prisma } from "@/lib/prisma";
import { CampaignsClient } from "./campaigns-client";

export const dynamic = "force-dynamic";

export default async function EmailCenterCampaignsPage() {
  const items = await prisma.massEmail.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      template: { select: { name: true } },
      fromUser: { select: { name: true } },
    },
  });
  return (
    <CampaignsClient
      campaigns={items.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        templateName: m.template?.name ?? null,
        fromName: m.fromUser?.name ?? null,
        totalCount: m.totalCount,
        sentCount: m.sentCount,
        failedCount: m.failedCount,
        suppressedCount: m.suppressedCount,
        openCount: m.openCount,
        clickCount: m.clickCount,
        scheduledAt: m.scheduledAt?.toISOString() ?? null,
        sentAt: m.sentAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  );
}
