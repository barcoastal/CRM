import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { caseStatusTone } from "@/lib/slds/status-tones";
import { BulkActionBar } from "@/components/lists/bulk-action-bar";
import { InlineEditCell } from "@/components/lists/inline-edit-cell";
import { getInlineConfig } from "@/lib/lists/inline-editable-fields";
import { CASE_STATUSES } from "@/lib/record-types";

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

  const subjectCfg = getInlineConfig("case", "subject");
  const statusCfg = getInlineConfig("case", "status");
  const priorityCfg = getInlineConfig("case", "priority");

  const columns: ListViewColumn<CaseRow>[] = [
    { key: "number", label: "Case Number", render: (c) => c.caseNumber },
    {
      key: "subject", label: "Subject",
      render: (c) => subjectCfg ? (
        <InlineEditCell entity="case" recordId={c.id} config={subjectCfg} value={c.subject} />
      ) : c.subject,
    },
    { key: "type", label: "Type", render: (c) => c.recordType.replace(/_/g, " ") },
    {
      key: "status", label: "Status",
      render: (c) => statusCfg ? (
        <InlineEditCell
          entity="case" recordId={c.id} config={statusCfg} value={c.status}
          display={<StatusPill label={c.status} tone={caseStatusTone(c.status)} />}
        />
      ) : <StatusPill label={c.status} tone={caseStatusTone(c.status)} />,
    },
    {
      key: "priority", label: "Priority",
      render: (c) => priorityCfg ? (
        <InlineEditCell
          entity="case" recordId={c.id} config={priorityCfg} value={c.priority}
          display={<StatusPill label={c.priority} tone={PRIORITY_TONE[c.priority] ?? "neutral"} />}
        />
      ) : <StatusPill label={c.priority} tone={PRIORITY_TONE[c.priority] ?? "neutral"} />,
    },
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
      selectable
      bulkBar={(
        <BulkActionBar
          entity="case"
          ownerField="ownerId"
          statusField="status"
          statusLabel="Status"
          statusOptions={CASE_STATUSES.map((s) => ({ value: s, label: s }))}
        />
      )}
    />
  );
}
