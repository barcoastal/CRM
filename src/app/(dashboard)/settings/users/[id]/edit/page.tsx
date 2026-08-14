import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserForm } from "@/components/settings/user-form";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, profiles, roles, managers] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true,
        profileId: true, hierarchyRoleId: true, managerId: true, isActive: true, isCloser: true, five9Username: true, mailboxAddress: true,
      },
    }),
    prisma.profile.findMany({ where: { isActive: true }, orderBy: { label: "asc" }, select: { id: true, name: true, label: true } }),
    prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!user) notFound();

  return (
    <UserForm
      userId={user.id}
      initial={{
        name: user.name,
        email: user.email,
        role: user.role,
        profileId: user.profileId,
        hierarchyRoleId: user.hierarchyRoleId,
        managerId: user.managerId,
        isActive: user.isActive,
        isCloser: user.isCloser,
        five9Username: user.five9Username,
        mailboxAddress: user.mailboxAddress,
      }}
      profiles={profiles}
      roles={roles}
      managers={managers}
    />
  );
}
