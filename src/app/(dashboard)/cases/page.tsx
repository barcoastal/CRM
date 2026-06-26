import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  SfListPage,
  type SfColumn,
  type SfRow,
  ownerAlias,
} from "@/components/slds/sf-list-page";
import { StatusPill } from "@/components/slds/record-page";
import { caseStatusTone } from "@/lib/slds/status-tones";
import { InlineEditCell } from "@/components/lists/inline-edit-cell";
import { getInlineConfig } from "@/lib/lists/inline-editable-fields";
import { CASE_STATUSES } from "@/lib/record-types";

interface CasesPageProps {
  searchParams: Promise<{
    search?: string;
    sort?: string;
    dir?: string;
    view?: string;
    page?: string;
  }>;
}

const LIMIT = 100;

// SF "All Open Cases" list view describe (2026-06-10). Match columns + order
// verbatim.
const COLUMNS: SfColumn[] = [
  { key: "caseNumber", label: "Case Number", width: 130, sortable: true },
  { key: "subject", label: "Subject", width: 320, sortable: true },
  { key: "status", label: "Status", width: 130, sortable: true },
  { key: "priority", label: "Priority", width: 110, sortable: true },
  { key: "createdDate", label: "Date/Time Opened", width: 150, sortable: false },
  { key: "ownerAlias", label: "Case Owner Alias", width: 150, sortable: true },
];

const SORT_MAP: Record<string, Prisma.CaseOrderByWithRelationInput> = {
  caseNumber: { caseNumber: "asc" },
  subject: { subject: "asc" },
  status: { status: "asc" },
  priority: { priority: "asc" },
  ownerAlias: { owner: { name: "asc" } },
};

const PRIORITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  URGENT: "danger", HIGH: "warning", NORMAL: "info", LOW: "neutral",
};

const VIEWS = [
  { value: "all-open", label: "All Open Cases" },
  { value: "all", label: "All Cases" },
];

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

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? "";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const view = params.view ?? "all-open";

  const where: Prisma.CaseWhereInput = {};
  if (view === "all-open") {
    where.status = { notIn: ["RESOLVED", "CLOSED"] };
  }
  if (search) {
    where.OR = [
      { caseNumber: { contains: search } },
      { subject: { contains: search } },
    ];
  }

  let orderBy: Prisma.CaseOrderByWithRelationInput = { createdAt: "desc" };
  if (sort && SORT_MAP[sort]) {
    if (sort === "ownerAlias") {
      orderBy = { owner: { name: dir } };
    } else {
      const key = Object.keys(SORT_MAP[sort])[0] as keyof Prisma.CaseOrderByWithRelationInput;
      orderBy = { [key]: dir } as Prisma.CaseOrderByWithRelationInput;
    }
  } else {
    orderBy = { createdAt: "desc" };
  }

  const [items, total] = await Promise.all([
    prisma.case.findMany({
      where,
      select: {
        id: true,
        caseNumber: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy,
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.case.count({ where }),
  ]);

  const subjectCfg = getInlineConfig("case", "subject");
  const statusCfg = getInlineConfig("case", "status");
  const priorityCfg = getInlineConfig("case", "priority");

  const rows: SfRow[] = items.map((c) => {
    return {
      id: c.id,
      href: `/cases/${c.id}`,
      cells: [
        c.caseNumber || "—",
        subjectCfg ? (
          <InlineEditCell key="subject" entity="case" recordId={c.id} config={subjectCfg} value={c.subject} />
        ) : (c.subject || "—"),
        statusCfg ? (
          <InlineEditCell
            key="status"
            entity="case"
            recordId={c.id}
            config={statusCfg}
            value={c.status}
            display={<StatusPill label={c.status} tone={caseStatusTone(c.status)} />}
          />
        ) : <StatusPill label={c.status} tone={caseStatusTone(c.status)} />,
        priorityCfg ? (
          <InlineEditCell
            key="priority"
            entity="case"
            recordId={c.id}
            config={priorityCfg}
            value={c.priority}
            display={<StatusPill label={c.priority} tone={PRIORITY_TONE[c.priority] ?? "neutral"} />}
          />
        ) : <StatusPill label={c.priority} tone={PRIORITY_TONE[c.priority] ?? "neutral"} />,
        fmtDateTime(c.createdAt) || "—",
        ownerAlias(c.owner) || "—",
      ],
    };
  });

  const preservedParams: Record<string, string> = {};
  if (params.view) preservedParams.view = params.view;

  const subtitle = VIEWS.find((v) => v.value === view)?.label ?? "All Open Cases";

  return (
    <SfListPage
      entity="case"
      title="Cases"
      subtitle={subtitle}
      count={total}
      iconColor="#f2cf5b"
      iconSlug="case"
      actions={[
        { label: "New", href: "/cases/new" },
        { label: "Change Owner" },
        { label: "Change Status" },
      ]}
      columns={COLUMNS}
      rows={rows}
      pathname="/cases"
      sortKey={sort || undefined}
      sortDir={dir}
      searchQuery={search}
      preservedParams={preservedParams}
      views={VIEWS}
      currentView={view}
      page={page}
      pageSize={LIMIT}
      massConfig={{
        entity: "case",
        statusField: "status",
        statusLabel: "Status",
        statusOptions: CASE_STATUSES.map((s) => ({ value: s, label: s })),
      }}
    />
  );
}
