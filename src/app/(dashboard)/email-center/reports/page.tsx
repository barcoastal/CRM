// src/app/(dashboard)/email-center/reports/page.tsx
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function EmailCenterReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true },
  });
  if (!me) redirect("/login");
  const isAdmin = ADMIN_ROLES.includes(me.role);
  const users = isAdmin
    ? await prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  return <ReportsClient me={{ id: me.id, name: me.name }} isAdmin={isAdmin} users={users} />;
}
