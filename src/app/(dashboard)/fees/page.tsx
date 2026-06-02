import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { genericTone } from "@/lib/slds/status-tones";

type FeeRow = {
  id: string;
  recordType: string;
  amount: number;
  chargedDate: Date;
  status: string;
  programPlan: { id: string; account: { id: string; name: string } };
  chargedBy: { id: string; name: string } | null;
};

export default async function FeesPage() {
  const items = await prisma.fee.findMany({
    include: {
      programPlan: { include: { account: { select: { id: true, name: true } } } },
      chargedBy: { select: { id: true, name: true } },
    },
    orderBy: { chargedDate: "desc" },
    take: 100,
  });
  const total = await prisma.fee.count();
  const columns: ListViewColumn<FeeRow>[] = [
    {
      key: "account",
      label: "Account",
      render: (f) => <Link href={`/accounts/${f.programPlan.account.id}`} style={{ color: "#1589ee" }}>{f.programPlan.account.name}</Link>,
    },
    { key: "type", label: "Type", render: (f) => f.recordType.replace(/_/g, " ") },
    { key: "amount", label: "Amount", render: (f) => `$${f.amount.toLocaleString()}` },
    { key: "date", label: "Charged", render: (f) => f.chargedDate.toLocaleDateString() },
    { key: "status", label: "Status", render: (f) => <StatusPill label={f.status} tone={genericTone(f.status)} /> },
    { key: "by", label: "Charged By", render: (f) => f.chargedBy?.name ?? "—" },
  ];
  return (
    <ListView
      entity="Fee"
      entityLabel="Fees"
      viewName="All Fees"
      totalCount={total}
      rows={items as FeeRow[]}
      columns={columns}
    />
  );
}
