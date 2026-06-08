import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { genericTone } from "@/lib/slds/status-tones";
import { BulkActionBar } from "@/components/lists/bulk-action-bar";
import { InlineEditCell } from "@/components/lists/inline-edit-cell";
import { getInlineConfig } from "@/lib/lists/inline-editable-fields";
import { TASK_STATUSES } from "@/lib/record-types";

type TaskRow = {
  id: string;
  subject: string;
  type: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  recordType: string;
  account: { id: string; name: string } | null;
  lead: { id: string; businessName: string; contactName: string } | null;
  contact: { id: string; fullName: string } | null;
  owner: { id: string; name: string } | null;
};

const PRIORITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  HIGH: "warning", NORMAL: "info", LOW: "neutral",
};

export default async function TasksPage() {
  const items = await prisma.task.findMany({
    include: {
      account: { select: { id: true, name: true } },
      lead: { select: { id: true, businessName: true, contactName: true } },
      contact: { select: { id: true, fullName: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 100,
  });
  const total = await prisma.task.count();

  const subjectCfg = getInlineConfig("task", "subject");
  const statusCfg = getInlineConfig("task", "status");
  const priorityCfg = getInlineConfig("task", "priority");
  const dueCfg = getInlineConfig("task", "dueDate");

  const columns: ListViewColumn<TaskRow>[] = [
    {
      key: "subject", label: "Subject",
      render: (t) => subjectCfg ? (
        <InlineEditCell entity="task" recordId={t.id} config={subjectCfg} value={t.subject} />
      ) : t.subject,
    },
    { key: "type", label: "Type", render: (t) => t.type },
    {
      key: "status", label: "Status",
      render: (t) => statusCfg ? (
        <InlineEditCell
          entity="task" recordId={t.id} config={statusCfg} value={t.status}
          display={<StatusPill label={t.status} tone={genericTone(t.status)} />}
        />
      ) : <StatusPill label={t.status} tone={genericTone(t.status)} />,
    },
    {
      key: "priority", label: "Priority",
      render: (t) => priorityCfg ? (
        <InlineEditCell
          entity="task" recordId={t.id} config={priorityCfg} value={t.priority}
          display={<StatusPill label={t.priority} tone={PRIORITY_TONE[t.priority] ?? "neutral"} />}
        />
      ) : <StatusPill label={t.priority} tone={PRIORITY_TONE[t.priority] ?? "neutral"} />,
    },
    {
      key: "due", label: "Due Date",
      render: (t) => dueCfg ? (
        <InlineEditCell entity="task" recordId={t.id} config={dueCfg} value={t.dueDate} />
      ) : (t.dueDate?.toLocaleDateString() ?? "—"),
    },
    {
      key: "related",
      label: "Related",
      render: (t) =>
        t.account ? <Link href={`/accounts/${t.account.id}`} style={{ color: "#1589ee" }}>{t.account.name}</Link> :
        t.lead ? <Link href={`/leads/${t.lead.id}`} style={{ color: "#1589ee" }}>{t.lead.contactName}</Link> :
        "—",
    },
    {
      key: "contact",
      label: "Contact",
      render: (t) => t.contact?.fullName ?? "—",
    },
    { key: "owner", label: "Assigned To", render: (t) => t.owner?.name ?? "—" },
  ];

  return (
    <ListView
      entity="Task"
      entityLabel="Tasks"
      viewName="My Open Tasks"
      totalCount={total}
      rows={items as TaskRow[]}
      columns={columns}
      rowHref={(t) => `/tasks/${t.id}`}
      newHref="/tasks/new"
      selectable
      bulkBar={(
        <BulkActionBar
          entity="task"
          ownerField="ownerId"
          statusField="status"
          statusLabel="Status"
          statusOptions={TASK_STATUSES.map((s) => ({ value: s, label: s }))}
        />
      )}
    />
  );
}
