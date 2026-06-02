import { prisma } from "@/lib/prisma";
import { UserForm } from "@/components/settings/user-form";

export default async function NewUserPage() {
  const [profiles, roles, managers] = await Promise.all([
    prisma.profile.findMany({
      where: { isActive: true },
      orderBy: { label: "asc" },
      select: { id: true, name: true, label: true },
    }),
    prisma.role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return <UserForm profiles={profiles} roles={roles} managers={managers} />;
}
