import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  SfListPage,
  type SfColumn,
  type SfRow,
  ownerAlias,
} from "@/components/slds/sf-list-page";
import { StatusPill } from "@/components/slds/record-page";
import { genericTone } from "@/lib/slds/status-tones";
import { InlineEditCell } from "@/components/lists/inline-edit-cell";
import { getInlineConfig } from "@/lib/lists/inline-editable-fields";
import { TASK_STATUSES } from "@/lib/record-types";

interface TasksPageProps {
  searchParams: Promise<{
    search?: string;
    sort?: string;
    dir?: string;
    view?: string;
  }>;
}

const LIMIT = 100;

// SF "Open Tasks" list view describe (2026-06-10). Match columns + order
// verbatim.
const COLUMNS: SfColumn[] = [
  { key: "subject", label: "Subject", width: 250, sortable: true },
  { key: "whoName", label: "Name", width: 180, sortable: false },
  { key: "whatName", label: "Related To", width: 180, sortable: false },
  { key: "dueDate", label: "Due Date", width: 110, sortable: true },
  { key: "status", label: "Status", width: 130, sortable: true },
  { key: "priority", label: "Priority", width: 110, sortable: true },
  { key: "reminder", label: "Reminder Date/Time", width: 150, sortable: false },
  { key: "assignedAlias", label: "Assigned Alias", width: 140, sortable: true },
  { key: "lastModified", label: "Last Modified Date/Time", width: 170, sortable: false },
  { key: "modifiedByAlias", label: "Last Modified By Alias", width: 160, sortable: false },
];

const SORT_MAP: Record<string, Prisma.TaskOrderByWithRelationInput> = {
  subject: { subject: "asc" },
  dueDate: { dueDate: "asc" },
  status: { status: "asc" },
  priority: { priority: "asc" },
  assignedAlias: { owner: { name: "asc" } },
};

const PRIORITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  HIGH: "warning", NORMAL: "info", LOW: "neutral",
};

const VIEWS = [
  { value: "open", label: "Open Tasks" },
  { value: "all", label: "All Tasks" },
];

function fmtDateShort(input: unknown): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(String(input));
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
}

function fmtDateTime(input: unknown): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(String(input));
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? "";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const view = params.view ?? "open";

  const where: Prisma.TaskWhereInput = {};
  if (view === "open") {
    where.status = { notIn: ["COMPLETED", "DEFERRED"] };
  }
  if (search) {
    where.subject = { contains: search };
  }

  let orderBy: Prisma.TaskOrderByWithRelationInput = { dueDate: "asc" };
  if (sort && SORT_MAP[sort]) {
    if (sort === "assignedAlias") {
      orderBy = { owner: { name: dir } };
    } else {
      const key = Object.keys(SORT_MAP[sort])[0] as keyof Prisma.TaskOrderByWithRelationInput;
      orderBy = { [key]: dir } as Prisma.TaskOrderByWithRelationInput;
    }
  }

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        dueDate: true,
        reminderAt: true,
        updatedAt: true,
        // Who → Contact or Lead
        contact: { select: { id: true, firstName: true, lastName: true, fullName: true } },
        lead: { select: { id: true, contactName: true, businessName: true } },
        // What → Account, Opportunity, or Case
        account: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true } },
        case: { select: { id: true, caseNumber: true, subject: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy,
      take: LIMIT,
    }),
    prisma.task.count({ where }),
  ]);

  const subjectCfg = getInlineConfig("task", "subject");
  const statusCfg = getInlineConfig("task", "status");
  const priorityCfg = getInlineConfig("task", "priority");
  const dueCfg = getInlineConfig("task", "dueDate");

  const rows: SfRow[] = items.map((t) => {
    // Who.Name: Contact takes precedence over Lead.
    const whoName =
      t.contact?.fullName ||
      (t.contact ? `${t.contact.firstName ?? ""} ${t.contact.lastName ?? ""}`.trim() : "") ||
      t.lead?.contactName ||
      t.lead?.businessName ||
      "";

    // What.Name: Account → Opp → Case (case uses subject since it has no
    // single-line "name" field).
    const whatName =
      t.account?.name ||
      t.opportunity?.name ||
      t.case?.subject ||
      "";

    // Task has no lastModifiedBy relation in our schema — assignedTo is the
    // closest stand-in for "who last touched this row" in practice.
    const assignedAlias = ownerAlias(t.owner);
    const modifiedByAlias = "";

    return {
      id: t.id,
      href: `/tasks/${t.id}`,
      cells: [
        subjectCfg ? (
          <InlineEditCell key="subject" entity="task" recordId={t.id} config={subjectCfg} value={t.subject} />
        ) : (t.subject || "—"),
        whoName || "—",
        whatName || "—",
        dueCfg ? (
          <InlineEditCell key="due" entity="task" recordId={t.id} config={dueCfg} value={t.dueDate} display={fmtDateShort(t.dueDate) || "—"} />
        ) : (fmtDateShort(t.dueDate) || "—"),
        statusCfg ? (
          <InlineEditCell
            key="status"
            entity="task"
            recordId={t.id}
            config={statusCfg}
            value={t.status}
            display={<StatusPill label={t.status} tone={genericTone(t.status)} />}
          />
        ) : <StatusPill label={t.status} tone={genericTone(t.status)} />,
        priorityCfg ? (
          <InlineEditCell
            key="priority"
            entity="task"
            recordId={t.id}
            config={priorityCfg}
            value={t.priority}
            display={<StatusPill label={t.priority} tone={PRIORITY_TONE[t.priority] ?? "neutral"} />}
          />
        ) : <StatusPill label={t.priority} tone={PRIORITY_TONE[t.priority] ?? "neutral"} />,
        fmtDateTime(t.reminderAt) || "—",
        assignedAlias || "—",
        fmtDateTime(t.updatedAt) || "—",
        modifiedByAlias || "—",
      ],
    };
  });

  const preservedParams: Record<string, string> = {};
  if (params.view) preservedParams.view = params.view;

  const subtitle = VIEWS.find((v) => v.value === view)?.label ?? "Open Tasks";

  return (
    <SfListPage
      entity="task"
      title="Tasks"
      subtitle={subtitle}
      count={total}
      iconColor="#4bc076"
      iconSlug="task"
      actions={[
        { label: "New", href: "/tasks/new" },
        { label: "Change Owner" },
        { label: "Change Status" },
      ]}
      columns={COLUMNS}
      rows={rows}
      pathname="/tasks"
      sortKey={sort || undefined}
      sortDir={dir}
      searchQuery={search}
      preservedParams={preservedParams}
      views={VIEWS}
      currentView={view}
      massConfig={{
        entity: "task",
        statusField: "status",
        statusLabel: "Status",
        statusOptions: TASK_STATUSES.map((s) => ({ value: s, label: s })),
      }}
    />
  );
}
