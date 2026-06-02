import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { programPlanStatusTone } from "@/lib/slds/status-tones";

type PlanRow = {
  id: string;
  recordType: string;
  status: string;
  monthlyAmount: number;
  termMonths: number;
  startDate: Date;
  totalEnrolledDebt: number | null;
  account: { id: string; name: string };
  processor: { id: string; name: string; code: string } | null;
  _count: { drafts: number; fees: number };
};

export default async function ProgramPlansPage() {
  const items = await prisma.programPlan.findMany({
    include: {
      account: { select: { id: true, name: true } },
      processor: { select: { id: true, name: true, code: true } },
      _count: { select: { drafts: true, fees: true } },
    },
    orderBy: { startDate: "desc" },
    take: 100,
  });
  const total = await prisma.programPlan.count();
  const columns: ListViewColumn<PlanRow>[] = [
    {
      key: "account",
      label: "Account",
      render: (p) => <Link href={`/accounts/${p.account.id}`} style={{ color: "#1589ee" }}>{p.account.name}</Link>,
    },
    { key: "product", label: "Product", render: (p) => p.recordType.replace(/_/g, " ") },
    { key: "status", label: "Status", render: (p) => <StatusPill label={p.status} tone={programPlanStatusTone(p.status)} /> },
    { key: "monthly", label: "Monthly", render: (p) => `$${p.monthlyAmount.toLocaleString()}` },
    { key: "term", label: "Term", render: (p) => `${p.termMonths}mo` },
    { key: "debt", label: "Total Debt", render: (p) => p.totalEnrolledDebt ? `$${p.totalEnrolledDebt.toLocaleString()}` : "—" },
    { key: "processor", label: "Processor", render: (p) => p.processor?.code ?? "—" },
    { key: "drafts", label: "Drafts", render: (p) => p._count.drafts.toString() },
    { key: "start", label: "Start Date", render: (p) => p.startDate.toLocaleDateString() },
  ];
  return (
    <ListView
      entity="ProgramPlan"
      entityLabel="Program Plans"
      viewName="All Program Plans"
      totalCount={total}
      rows={items as PlanRow[]}
      columns={columns}
      rowHref={(p) => `/program-plans/${p.id}`}
      newHref="/program-plans/new"
    />
  );
}
