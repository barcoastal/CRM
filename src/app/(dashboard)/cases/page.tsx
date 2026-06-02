import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { caseStatusTone } from "@/lib/slds/status-tones";

type CaseRow = {
  id: string;
  caseNumber: string;
  subject: string;
  recordType: string;
  status: string;
  priority: string;
  escalationLevel: string;
  account: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  ownerGroup: { developerName: string; name: string } | null;
  createdAt: Date;
};

const PRIORITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  URGENT: "danger", HIGH: "warning", NORMAL: "info", LOW: "neutral",
};

export default async function CasesPage() {
  const items = await prisma.case.findMany({
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
      ownerGroup: { select: { developerName: true, name: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  const total = await prisma.case.count();

  const columns: ListViewColumn<CaseRow>[] = [
    { key: "number", label: "Case Number", render: (c) => c.caseNumber },
    { key: "subject", label: "Subject", render: (c) => c.subject },
    { key: "type", label: "Type", render: (c) => c.recordType.replace(/_/g, " ") },
    { key: "status", label: "Status", render: (c) => <StatusPill label={c.status} tone={caseStatusTone(c.status)} /> },
    { key: "priority", label: "Priority", render: (c) => <StatusPill label={c.priority} tone={PRIORITY_TONE[c.priority] ?? "neutral"} /> },
    { key: "level", label: "Level", render: (c) => c.escalationLevel },
    {
      key: "account",
      label: "Account",
      render: (c) => c.account ? <Link href={`/accounts/${c.account.id}`} style={{ color: "#1589ee" }}>{c.account.name}</Link> : "—",
    },
    {
      key: "owner",
      label: "Owner",
      render: (c) => c.owner?.name ?? c.ownerGroup?.name ?? "(unassigned)",
    },
  ];

  return (
    <ListView
      entity="Case"
      entityLabel="Cases"
      viewName="All Open Cases"
      totalCount={total}
      rows={items as CaseRow[]}
      columns={columns}
      rowHref={(c) => `/cases/${c.id}`}
      newHref="/cases/new"
    />
  );
}
