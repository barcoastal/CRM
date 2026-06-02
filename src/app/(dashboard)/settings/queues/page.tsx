import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";

type QueueRow = {
  id: string;
  name: string;
  developerName: string;
  type: string;
  supportedEntities: string | null;
  _count: { members: number };
};

export default async function QueuesPage() {
  const queues = await prisma.group.findMany({
    where: { type: "QUEUE" },
    include: { _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });
  const columns: ListViewColumn<QueueRow>[] = [
    { key: "name", label: "Name", render: (q) => q.name },
    { key: "dev", label: "Developer Name", render: (q) => q.developerName },
    { key: "supports", label: "Supported Entities", render: (q) => q.supportedEntities ?? "—" },
    { key: "members", label: "Members", render: (q) => q._count.members.toString() },
  ];
  return (
    <ListView
      entity="Settings"
      entityLabel="Queue"
      viewName="All Queues"
      totalCount={queues.length}
      rows={queues as QueueRow[]}
      columns={columns}
    />
  );
}
