import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";

type RoleRow = {
  id: string;
  name: string;
  developerName: string;
  parent: { name: string } | null;
  _count: { users: number };
};

export default async function RolesPage() {
  const roles = await prisma.role.findMany({
    include: {
      parent: { select: { name: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });
  const columns: ListViewColumn<RoleRow>[] = [
    { key: "name", label: "Role", render: (r) => r.name },
    { key: "dev", label: "Developer Name", render: (r) => r.developerName },
    { key: "parent", label: "Reports To", render: (r) => r.parent?.name ?? "(top of hierarchy)" },
    { key: "users", label: "Users", render: (r) => r._count.users.toString() },
  ];
  return (
    <ListView
      entity="Settings"
      entityLabel="Role"
      viewName="Role Hierarchy"
      totalCount={roles.length}
      rows={roles as RoleRow[]}
      columns={columns}
    />
  );
}
