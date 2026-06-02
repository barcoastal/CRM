import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";

type PermSetRow = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isCustom: boolean;
  _count: { permissions: number; profileLinks: number; userLinks: number };
};

export default async function PermissionSetsPage() {
  const sets = await prisma.permissionSet.findMany({
    include: { _count: { select: { permissions: true, profileLinks: true, userLinks: true } } },
    orderBy: { label: "asc" },
  });
  const columns: ListViewColumn<PermSetRow>[] = [
    { key: "label", label: "Label", render: (p) => p.label },
    { key: "name", label: "Developer Name", render: (p) => p.name },
    { key: "perms", label: "Permissions", render: (p) => p._count.permissions.toString() },
    { key: "profiles", label: "On Profiles", render: (p) => p._count.profileLinks.toString() },
    { key: "users", label: "Direct Users", render: (p) => p._count.userLinks.toString() },
    { key: "desc", label: "Description", render: (p) => p.description ?? "—" },
  ];
  return (
    <ListView
      entity="Settings"
      entityLabel="Permission Set"
      viewName="All Permission Sets"
      totalCount={sets.length}
      rows={sets as PermSetRow[]}
      columns={columns}
    />
  );
}
