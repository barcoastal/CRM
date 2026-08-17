import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WizardClient } from "./wizard-client";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function NewCampaignPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true },
  });
  if (!me) redirect("/login");
  const [templates, segments, listViews, dialerCampaigns, users] = await Promise.all([
    prisma.emailTemplate.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.segment.findMany({ select: { id: true, name: true, entity: true }, orderBy: { name: "asc" } }),
    prisma.listView.findMany({
      where: { entity: { in: ["Lead", "Contact"] } },
      select: { id: true, name: true, entity: true },
      orderBy: [{ entity: "asc" }, { name: "asc" }],
    }),
    prisma.campaign.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ADMIN_ROLES.includes(me.role)
      ? prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  return (
    <WizardClient
      me={{ id: me.id, name: me.name ?? "" }}
      templates={templates}
      segments={segments}
      listViews={listViews}
      dialerCampaigns={dialerCampaigns}
      users={users}
    />
  );
}
