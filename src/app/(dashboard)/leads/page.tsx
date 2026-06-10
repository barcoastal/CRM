import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import {
  SfListPage,
  type SfColumn,
  type SfRow,
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

// SF "My Leads" list view describe (2026-06-10). Match the columns + order
// verbatim. Pull from typed Lead columns where they exist; fall back to
// sfDataJson for SF-custom fields (Sub_Disposition__c, Lead_Vendor_*, etc.).
const COLUMNS: SfColumn[] = [
  { key: "name", label: "Name", width: 180, sortable: true },
  { key: "estimatedTotalDebt", label: "Estimated Total Debt", width: 150, sortable: false },
  { key: "lastModified", label: "Last Modified Date", width: 130, sortable: false },
  { key: "lastContacted", label: "Last Contacted DateTime", width: 150, sortable: false },
  { key: "phone", label: "Phone", width: 150, sortable: true },
  { key: "state", label: "State/Province", width: 110, sortable: false },
  { key: "timezone", label: "Timezone", width: 110, sortable: false },
  { key: "status", label: "Lead Status", width: 140, sortable: true },
  { key: "subDisposition", label: "Sub Disposition", width: 180, sortable: false },
  { key: "leadVendor", label: "Lead Vendor", width: 140, sortable: false },
  { key: "source", label: "Lead Source", width: 140, sortable: true },
  { key: "fronter", label: "Fronter", width: 140, sortable: false },
  { key: "ownerFullName", label: "Owner Full Name", width: 150, sortable: true },
  { key: "createdDate", label: "Created Date", width: 120, sortable: false },
];

const SORT_MAP: Record<string, Prisma.LeadOrderByWithRelationInput> = {
  name: { contactName: "asc" },
  phone: { phone: "asc" },
  status: { status: "asc" },
  source: { source: "asc" },
  ownerFullName: { assignedTo: { name: "asc" } },
};

const VIEWS = [
  { value: "recent", label: "Recently Viewed" },
  { value: "all", label: "All Leads" },
  { value: "my-open", label: "My Open Leads" },
  { value: "this-week", label: "This Week's Leads" },
  { value: "today-activity", label: "Today's Activity" },
];

// Duplicated from accounts/page.tsx (not exported there). Keep in sync.
function fmtDateShort(input: unknown): string {
  if (!input) return "";
  const s = String(input).trim();
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
}

function fmtMoney(input: unknown): string {
  if (input === null || input === undefined || input === "") return "";
  const n = typeof input === "number" ? input : Number(String(input).replace(/[,$]/g, ""));
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

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
    if (sort === "ownerFullName") {
      orderBy = { assignedTo: { name: dir } };
    } else {
      const key = Object.keys(SORT_MAP[sort])[0] as keyof Prisma.LeadOrderByWithRelationInput;
      orderBy = { [key]: dir } as Prisma.LeadOrderByWithRelationInput;
    }
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

  const rows: SfRow[] = leads.map((lead) => {
    let sfData: Record<string, unknown> = {};
    if (lead.sfDataJson) {
      try { sfData = JSON.parse(lead.sfDataJson) as Record<string, unknown>; } catch { /* ignore */ }
    }

    const subDisposition =
      (typeof sfData.Sub_Disposition__c === "string" ? sfData.Sub_Disposition__c : "") || "";

    const estimatedDebt = fmtMoney(sfData.Estimated_Total_Debt__c);
    const lastContacted = fmtDateShort(sfData.Last_Contacted_DateTime__c);
    const stateVal =
      (typeof sfData.StateCode === "string" ? sfData.StateCode : "") || lead.state || "";
    const timezone =
      (typeof sfData.Timezone__c === "string" ? sfData.Timezone__c : "") || "";
    const leadVendorRel = sfData.Lead_Vendor_ID__r as { Name?: string } | undefined;
    const leadVendor =
      leadVendorRel?.Name ||
      (typeof sfData.Lead_Vendor_ID_Text__c === "string" ? sfData.Lead_Vendor_ID_Text__c : "") ||
      "";
    const fronter =
      (typeof sfData.Fronter__c === "string" ? sfData.Fronter__c : "") || "";
    const ownerFullName =
      lead.assignedTo?.name ||
      (typeof sfData.Owner_Full_Name__c === "string" ? sfData.Owner_Full_Name__c : "") ||
      lead.assignedTo?.email ||
      "";

    // Name: prefer the SF Lead_Name__c style (contact + business). Falls back to
    // contactName which is the canonical name column on our Lead model.
    const nameDisplay = lead.contactName || lead.businessName || "(no name)";

    const nameCfg = getInlineConfig("lead", "contactName");
    const statusCfg = getInlineConfig("lead", "status");
    const sourceCfg = getInlineConfig("lead", "source");
    const phoneCfg = getInlineConfig("lead", "phone");
    return {
      id: lead.id,
      href: `/leads/${lead.id}`,
      cells: [
        nameCfg ? (
          <InlineEditCell key="name" entity="lead" recordId={lead.id} config={nameCfg} value={lead.contactName} display={nameDisplay} />
        ) : (nameDisplay || "—"),
        estimatedDebt || "—",
        fmtDateShort(lead.updatedAt) || "—",
        lastContacted || "—",
        phoneCfg ? (
          <InlineEditCell key="phone" entity="lead" recordId={lead.id} config={phoneCfg} value={lead.phone} />
        ) : (lead.phone || "—"),
        stateVal || "—",
        timezone || "—",
        statusCfg ? (
          <InlineEditCell key="status" entity="lead" recordId={lead.id} config={statusCfg} value={lead.status} />
        ) : (lead.status || "—"),
        subDisposition || "—",
        leadVendor || "—",
        sourceCfg ? (
          <InlineEditCell key="source" entity="lead" recordId={lead.id} config={sourceCfg} value={lead.source} />
        ) : (lead.source || "—"),
        fronter || "—",
        ownerFullName || "—",
        fmtDateShort(lead.createdAt) || "—",
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
