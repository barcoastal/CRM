import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";

type AppLogRow = {
  id: string;
  level: string;
  source: string;
  message: string;
  createdAt: Date;
  user: { id: string; name: string } | null;
};

const LEVEL_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  ERROR: "danger", WARN: "warning", INFO: "info", DEBUG: "neutral",
};

export default async function AppLogPage() {
  const items = await prisma.applicationLog.findMany({
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const total = await prisma.applicationLog.count();
  const columns: ListViewColumn<AppLogRow>[] = [
    { key: "when", label: "When", render: (a) => a.createdAt.toLocaleString() },
    { key: "level", label: "Level", render: (a) => <StatusPill label={a.level} tone={LEVEL_TONE[a.level] ?? "neutral"} /> },
    { key: "source", label: "Source", render: (a) => a.source },
    { key: "msg", label: "Message", render: (a) => a.message },
    { key: "user", label: "User", render: (a) => a.user?.name ?? "—" },
  ];
  return (
    <ListView
      entity="Settings"
      entityLabel="Application Log"
      viewName="Recent Logs"
      totalCount={total}
      rows={items as AppLogRow[]}
      columns={columns}
    />
  );
}
