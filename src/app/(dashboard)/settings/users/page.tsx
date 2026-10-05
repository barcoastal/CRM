import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ViewAsUserButton } from "@/components/admin/user-preview";
import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  profile: { name: string; label: string } | null;
  hierarchyRole: { name: string } | null;
  manager: { id: string; name: string } | null;
};

export default async function UsersPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasPermission(session.user.permissions, "User.View")) return <p>Access denied. You do not have permission to view users.</p>;
  const canPreview = session.user.role === "ADMIN" && !session.impersonation && !session.user.mustResetPassword;
  const users = await prisma.user.findMany({
    include: {
      profile: { select: { name: true, label: true } },
      hierarchyRole: { select: { name: true } },
      manager: { select: { id: true, name: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  const total = users.length;

  const columns: ListViewColumn<UserRow>[] = [
    { key: "name", label: "Name", render: (u) => u.name },
    { key: "email", label: "Email", render: (u) => u.email },
    { key: "profile", label: "Profile", render: (u) => u.profile?.label ?? "—" },
    { key: "role", label: "Role", render: (u) => u.hierarchyRole?.name ?? "—" },
    { key: "manager", label: "Manager", render: (u) => u.manager?.name ?? "—" },
    {
      key: "active",
      label: "Status",
      render: (u) => <StatusPill label={u.isActive ? "Active" : "Inactive"} tone={u.isActive ? "success" : "neutral"} />,
    },
    {
      key: "lastLogin",
      label: "Last Login",
      render: (u) => u.lastLoginAt?.toLocaleString() ?? "—",
    },
  ];
  if (canPreview) columns.push({
    key: "preview", label: "Preview", width: 150,
    render: u => u.isActive && u.id !== session.user.id
      ? <ViewAsUserButton userId={u.id} userName={u.name} /> : <span>—</span>,
  });

  return (
    <ListView
      entity="User"
      entityLabel="User"
      viewName="All Users"
      totalCount={total}
      rows={users as UserRow[]}
      columns={columns}
      rowHref={(u) => `/settings/users/${u.id}`}
      newHref={hasPermission(session.user.permissions, "User.Create") ? "/settings/users/new" : undefined}
    />
  );
}
