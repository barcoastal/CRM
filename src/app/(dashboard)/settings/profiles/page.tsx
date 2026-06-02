import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";

type ProfileRow = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  userType: string;
  isActive: boolean;
  _count: { users: number; permissions: number };
};

export default async function ProfilesPage() {
  const profiles = await prisma.profile.findMany({
    include: { _count: { select: { users: true, permissions: true } } },
    orderBy: { label: "asc" },
  });
  const columns: ListViewColumn<ProfileRow>[] = [
    { key: "label", label: "Profile", render: (p) => p.label },
    { key: "name", label: "Developer Name", render: (p) => p.name },
    { key: "type", label: "User Type", render: (p) => p.userType },
    { key: "users", label: "Users", render: (p) => p._count.users.toString() },
    { key: "perms", label: "Perm Sets", render: (p) => p._count.permissions.toString() },
    { key: "active", label: "Active", render: (p) => <StatusPill label={p.isActive ? "Active" : "Inactive"} tone={p.isActive ? "success" : "neutral"} /> },
    { key: "desc", label: "Description", render: (p) => p.description ?? "—" },
  ];
  return (
    <ListView
      entity="Settings"
      entityLabel="Profile"
      viewName="All Profiles"
      totalCount={profiles.length}
      rows={profiles as ProfileRow[]}
      columns={columns}
    />
  );
}
