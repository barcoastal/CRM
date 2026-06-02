import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";

type AuditRow = {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  createdAt: Date;
  user: { id: string; name: string } | null;
};

export default async function AuditLogPage() {
  const items = await prisma.auditLog.findMany({
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const total = await prisma.auditLog.count();
  const columns: ListViewColumn<AuditRow>[] = [
    { key: "when", label: "When", render: (a) => a.createdAt.toLocaleString() },
    { key: "who", label: "Who", render: (a) => a.user?.name ?? "(system)" },
    { key: "action", label: "Action", render: (a) => a.action },
    { key: "entity", label: "Entity", render: (a) => a.entity },
    {
      key: "id",
      label: "Record",
      render: (a) => <code style={{ fontSize: 11, color: "#706e6b" }}>{a.entityId.slice(0, 12)}…</code>,
    },
  ];
  return (
    <ListView
      entity="Settings"
      entityLabel="Audit Log"
      viewName="Recent Activity"
      totalCount={total}
      rows={items as AuditRow[]}
      columns={columns}
    />
  );
}
