import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { draftStatusTone } from "@/lib/slds/status-tones";

type DraftRow = {
  id: string;
  scheduledDate: Date;
  amount: number;
  status: string;
  attemptNumber: number;
  maxAttempts: number;
  returnCode: string | null;
  programPlan: { id: string; account: { id: string; name: string } };
};

export default async function DraftsPage() {
  const items = await prisma.draft.findMany({
    include: { programPlan: { include: { account: { select: { id: true, name: true } } } } },
    orderBy: { scheduledDate: "desc" },
    take: 100,
  });
  const total = await prisma.draft.count();
  const columns: ListViewColumn<DraftRow>[] = [
    { key: "date", label: "Scheduled", render: (d) => d.scheduledDate.toLocaleDateString() },
    {
      key: "account",
      label: "Account",
      render: (d) => <Link href={`/accounts/${d.programPlan.account.id}`} style={{ color: "#1589ee" }}>{d.programPlan.account.name}</Link>,
    },
    { key: "amount", label: "Amount", render: (d) => `$${d.amount.toLocaleString()}` },
    { key: "status", label: "Status", render: (d) => <StatusPill label={d.status} tone={draftStatusTone(d.status)} /> },
    { key: "attempt", label: "Attempt", render: (d) => `${d.attemptNumber}/${d.maxAttempts}` },
    { key: "code", label: "Return Code", render: (d) => d.returnCode ?? "—" },
  ];
  return (
    <ListView
      entity="Draft"
      entityLabel="Drafts"
      viewName="All Drafts"
      totalCount={total}
      rows={items as DraftRow[]}
      columns={columns}
      rowHref={(d) => `/drafts/${d.id}`}
    />
  );
}
