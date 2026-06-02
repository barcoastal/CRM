import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";

type DispoRow = {
  id: string;
  entity: string;
  category: string;
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  leadStatusMapping: string | null;
};

export default async function DispositionsPage() {
  const items = await prisma.disposition.findMany({
    orderBy: [{ entity: "asc" }, { category: "asc" }, { sortOrder: "asc" }],
  });
  const columns: ListViewColumn<DispoRow>[] = [
    { key: "entity", label: "Entity", render: (d) => d.entity },
    { key: "category", label: "Category", render: (d) => d.category },
    { key: "label", label: "Label", render: (d) => d.label },
    { key: "value", label: "Stored Value", render: (d) => <code style={{ fontSize: 11 }}>{d.value}</code> },
    { key: "mapping", label: "Lead Status When Picked", render: (d) => d.leadStatusMapping ?? "—" },
    { key: "active", label: "Active", render: (d) => <StatusPill label={d.isActive ? "Active" : "Inactive"} tone={d.isActive ? "success" : "neutral"} /> },
  ];
  return (
    <ListView
      entity="Settings"
      entityLabel="Disposition"
      viewName="All Dispositions"
      totalCount={items.length}
      rows={items as DispoRow[]}
      columns={columns}
    />
  );
}
