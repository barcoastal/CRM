import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewProcessClient } from "@/components/approvals/new-process-client";

export default async function NewApprovalProcessPage() {
  await auth();
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return <NewProcessClient users={users} />;
}
