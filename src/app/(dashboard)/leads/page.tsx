import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import {
  SfListPage,
  type SfColumn,
  type SfRow,
  ownerAlias,
} from "@/components/slds/sf-list-page";
import { LEAD_STATUSES } from "@/lib/validations/lead";
import { InlineEditCell } from "@/components/lists/inline-edit-cell";
import { getInlineConfig } from "@/lib/lists/inline-editable-fields";

interface LeadsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    source?: string;
    recordType?: string;
    assignedToId?: string;
    sort?: string;
    dir?: string;
    view?: string;
  }>;
}

const LIMIT = 50;

// SF Lead list columns (match docs/sf-screenshots/sf-lead-list.png):
// # | checkbox | Name | Lead ID | Company | Phone | Email | Lead Status |
// Lead Source | Sub-Disposition | Owner Alias
const COLUMNS: SfColumn[] = [
  { key: "name", label: "Name", width: 200, sortable: true },
  { key: "leadId", label: "Lead ID", width: 120, sortable: true },
  { key: "company", label: "Company", width: 260, sortable: true },
  { key: "phone", label: "Phone", width: 150, sortable: true },
  { key: "email", label: "Email", width: 240, sortable: true },
  { key: "status", label: "Lead Status", width: 140, sortable: true },
  { key: "source", label: "Lead Source", width: 130, sortable: true },
  { key: "subDisposition", label: "Sub-Disposition", width: 140, sortable: true },
  { key: "ownerAlias", label: "Owner Alias", width: 120, sortable: true },
];

const SORT_MAP: Record<string, Prisma.LeadOrderByWithRelationInput> = {
  name: { contactName: "asc" },
  leadId: { sfId: "asc" },
  company: { businessName: "asc" },
  phone: { phone: "asc" },
  email: { email: "asc" },
  status: { status: "asc" },
  source: { source: "asc" },
};

const VIEWS = [
  { value: "recent", label: "Recently Viewed" },
  { value: "all", label: "All Leads" },
  { value: "my-open", label: "My Open Leads" },
  { value: "this-week", label: "This Week's Leads" },
  { value: "today-activity", label: "Today's Activity" },
];

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? "";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const view = params.view ?? "recent";

  const session = await auth();
  const myId = session?.user?.id ?? "";

  const where: Prisma.LeadWhereInput = {};
  if (search) {
    where.OR = [
      { businessName: { contains: search } },
      { contactName: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.source) where.source = params.source;
  if (params.recordType) where.recordType = params.recordType;
  if (params.assignedToId) where.assignedToId = params.assignedToId;

  // Apply view-based filters
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (view === "my-open" && myId) {
    where.assignedToId = myId;
    where.status = { notIn: ["ENROLLED", "LOST", "DNC"] };
  } else if (view === "this-week") {
    where.createdAt = { gte: weekStart };
  } else if (view === "today-activity") {
    where.OR = [
      ...(where.OR ?? []),
      { lastContactedAt: { gte: todayStart, lt: tomorrow } },
      { updatedAt: { gte: todayStart, lt: tomorrow } },
    ];
  }
  // "all" → no extra filter. "recent" → default order = most recently updated/created.

  // Build prisma orderBy from sort key
  let orderBy: Prisma.LeadOrderByWithRelationInput =
    view === "recent" ? { updatedAt: "desc" } : { createdAt: "desc" };
  if (sort && SORT_MAP[sort]) {
    const key = Object.keys(SORT_MAP[sort])[0] as keyof Prisma.LeadOrderByWithRelationInput;
    orderBy = { [key]: dir } as Prisma.LeadOrderByWithRelationInput;
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy,
      take: LIMIT,
    }),
    prisma.lead.count({ where }),
  ]);

  // Pre-render every cell here in the server component. Pulls SF
  // Sub_Disposition__c out of the lossless JSON snapshot when present.
  const rows: SfRow[] = leads.map((lead) => {
    let subDisposition = "";
    if (lead.sfDataJson) {
      try {
        const sf = JSON.parse(lead.sfDataJson) as Record<string, unknown>;
        const sub = sf["Sub_Disposition__c"];
        if (typeof sub === "string") subDisposition = sub;
      } catch {
        /* ignore bad json */
      }
    }
    const shortLeadId = lead.sfId ?? lead.id.slice(-8).toUpperCase();
    const nameCfg = getInlineConfig("lead", "contactName");
    const statusCfg = getInlineConfig("lead", "status");
    const sourceCfg = getInlineConfig("lead", "source");
    const phoneCfg = getInlineConfig("lead", "phone");
    const emailCfg = getInlineConfig("lead", "email");
    return {
      id: lead.id,
      href: `/leads/${lead.id}`,
      cells: [
        nameCfg ? (
          <InlineEditCell key="name" entity="lead" recordId={lead.id} config={nameCfg} value={lead.contactName} />
        ) : (lead.contactName || "—"),
        shortLeadId,
        lead.businessName || "—",
        phoneCfg ? (
          <InlineEditCell key="phone" entity="lead" recordId={lead.id} config={phoneCfg} value={lead.phone} />
        ) : (lead.phone || "—"),
        emailCfg ? (
          <InlineEditCell key="email" entity="lead" recordId={lead.id} config={emailCfg} value={lead.email} />
        ) : (lead.email || "—"),
        statusCfg ? (
          <InlineEditCell key="status" entity="lead" recordId={lead.id} config={statusCfg} value={lead.status} />
        ) : (lead.status || "—"),
        sourceCfg ? (
          <InlineEditCell key="source" entity="lead" recordId={lead.id} config={sourceCfg} value={lead.source} />
        ) : (lead.source || "—"),
        subDisposition || "",
        ownerAlias(lead.assignedTo) || "—",
      ],
    };
  });

  const preservedParams: Record<string, string> = {};
  if (params.status) preservedParams.status = params.status;
  if (params.source) preservedParams.source = params.source;
  if (params.recordType) preservedParams.recordType = params.recordType;
  if (params.assignedToId) preservedParams.assignedToId = params.assignedToId;
  if (params.view) preservedParams.view = params.view;

  const subtitle = VIEWS.find((v) => v.value === view)?.label ?? "Recently Viewed";

  return (
    <SfListPage
      entity="lead"
      title="Leads"
      subtitle={subtitle}
      count={total}
      iconColor="#f88962"
      iconSlug="lead"
      actions={[
        { label: "New", href: "/leads/new" },
        { label: "Import" },
        { label: "Change Owner" },
        { label: "Change Status" },
        { label: "Send List Email" },
      ]}
      columns={COLUMNS}
      rows={rows}
      pathname="/leads"
      sortKey={sort || undefined}
      sortDir={dir}
      searchQuery={search}
      preservedParams={preservedParams}
      views={VIEWS}
      currentView={view}
      massConfig={{
        entity: "lead",
        statusField: "status",
        statusLabel: "Status",
        statusOptions: LEAD_STATUSES.map((s) => ({ value: s, label: s })),
      }}
    />
  );
}
