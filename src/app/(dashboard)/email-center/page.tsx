import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export default async function EmailCenterInboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, mailboxAddress: true },
  });
  if (!me) redirect("/login");
  const isAdmin = ADMIN_ROLES.includes(me.role);

  const users = isAdmin
    ? await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, mailboxAddress: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <InboxClient
      me={{ id: me.id, name: me.name, mailboxAddress: me.mailboxAddress }}
      isAdmin={isAdmin}
      users={users}
    />
  );
}
