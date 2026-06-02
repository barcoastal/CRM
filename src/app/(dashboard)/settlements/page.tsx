import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { settlementStatusTone } from "@/lib/slds/status-tones";

type SettlementRow = {
  id: string;
  recordType: string;
  settledAmount: number;
  savingsAmount: number;
  savingsPercent: number;
  status: string;
  settledDate: Date;
  payoffDueDate: Date | null;
  debt: { id: string; creditorName: string; originalBalance: number; opportunity: { id: string } | null };
};

export default async function SettlementsPage() {
  const items = await prisma.settlement.findMany({
    include: {
      debt: {
        select: { id: true, creditorName: true, originalBalance: true, opportunity: { select: { id: true } } },
      },
    },
    orderBy: { settledDate: "desc" },
    take: 100,
  });
  const total = await prisma.settlement.count();
  const columns: ListViewColumn<SettlementRow>[] = [
    { key: "creditor", label: "Creditor", render: (s) => s.debt.creditorName },
    { key: "settled", label: "Settled", render: (s) => `$${s.settledAmount.toLocaleString()}` },
    { key: "original", label: "Original", render: (s) => `$${s.debt.originalBalance.toLocaleString()}` },
    { key: "savings", label: "Savings", render: (s) => `$${s.savingsAmount.toLocaleString()} (${Math.round(s.savingsPercent * 100)}%)` },
    { key: "type", label: "Type", render: (s) => s.recordType },
    { key: "status", label: "Status", render: (s) => <StatusPill label={s.status} tone={settlementStatusTone(s.status)} /> },
    { key: "date", label: "Settled Date", render: (s) => s.settledDate.toLocaleDateString() },
    { key: "due", label: "Payoff Due", render: (s) => s.payoffDueDate?.toLocaleDateString() ?? "—" },
  ];
  return (
    <ListView
      entity="Settlement"
      entityLabel="Settlements"
      viewName="All Settlements"
      totalCount={total}
      rows={items as SettlementRow[]}
      columns={columns}
      rowHref={(s) => `/settlements/${s.id}`}
    />
  );
}
