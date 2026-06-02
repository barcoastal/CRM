import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { genericTone } from "@/lib/slds/status-tones";

type OpRow = {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
};

export default async function AsyncOpsPage() {
  const items = await prisma.asyncOperation.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const total = await prisma.asyncOperation.count();
  const columns: ListViewColumn<OpRow>[] = [
    { key: "when", label: "Queued", render: (o) => o.createdAt.toLocaleString() },
    { key: "type", label: "Type", render: (o) => o.type },
    { key: "status", label: "Status", render: (o) => <StatusPill label={o.status} tone={genericTone(o.status)} /> },
    { key: "started", label: "Started", render: (o) => o.startedAt?.toLocaleString() ?? "—" },
    { key: "finished", label: "Finished", render: (o) => o.finishedAt?.toLocaleString() ?? "—" },
    { key: "err", label: "Error", render: (o) => o.error ?? "" },
  ];
  return (
    <ListView
      entity="Settings"
      entityLabel="Async Operation"
      viewName="Recent Jobs"
      totalCount={total}
      rows={items as OpRow[]}
      columns={columns}
    />
  );
}
