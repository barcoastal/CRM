import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GmailSyncClient } from "./gmail-client";

export const dynamic = "force-dynamic";
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function GmailSyncSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!ADMIN_ROLES.includes(me?.role ?? "")) redirect("/email-center");
  const configured = Boolean(process.env.GOOGLE_SA_CLIENT_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY);
  return <GmailSyncClient configured={configured} />;
}
