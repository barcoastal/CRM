import Link from "next/link";
import { LeadListPicker } from "@/components/leads/lead-list-picker";
import { LEAD_LIST_VIEWS } from "@/lib/lead-list-catalog";
import { leadListIdsQuery } from "@/lib/lead-list-query";
import { recordScope } from "@/lib/record-access";
import { redactSsn } from "@/lib/ssn-privacy";
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
import { KanbanBoard } from "@/components/lists/kanban-board";
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
    display?: string;
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

const RECENT_COLUMNS: SfColumn[] = [
  {key:"name",label:"Name",width:180,sortable:true},
  {key:"leadId",label:"Lead Id",width:180,sortable:true},
  {key:"company",label:"Company",width:180,sortable:true},
  {key:"phone",label:"Phone",width:150,sortable:true},
  {key:"status",label:"Lead Status",width:140,sortable:true},
  {key:"source",label:"Lead Source",width:140,sortable:true},
  {key:"totalDebt",label:"Total Debt Amount",width:150},
  {key:"ownerAlias",label:"Owner Alias",width:120},
  {key:"subDisposition",label:"Sub Disposition",width:180},
  {key:"createdDate",label:"Created Date",width:130,sortable:true},
];

const SORT_MAP: Record<string, Prisma.LeadOrderByWithRelationInput> = {
  name: { contactName: "asc" },
  company: { businessName: "asc" },
  leadId: { sfId: "asc" },
  createdDate: { createdAt: "asc" },
  phone: { phone: "asc" },
  status: { status: "asc" },
  source: { source: "asc" },
  ownerFullName: { assignedTo: { name: "asc" } },
};

const VIEWS = LEAD_LIST_VIEWS;

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
  const page = Math.min(40, Math.max(1, parseInt(params.page ?? "1", 10) || 1));
  const view = params.view === "my-open" ? "my-leads" : params.view ?? "recent";
  const definition = VIEWS.find(v => v.value === view) ?? VIEWS.find(v => v.value === "recent")!;

  const session = await auth();
  const myId = session?.user?.id ?? "";

  const scope = await recordScope("lead");
  const where: Prisma.LeadWhereInput = { AND: [scope] };
  const recent = await prisma.leadViewHistory.findMany({where:{userId:myId},orderBy:{viewedAt:"desc"},take:100,select:{leadId:true}});
  const recentIds = recent.map(r=>r.leadId);
  const viewIds = await prisma.$queryRaw<Array<{id:string}>>(leadListIdsQuery({
    ...params, search, definition, scope, userId:myId, recentIds,
  }));
  where.id = {in:viewIds.map(r=>r.id)};
  // Build prisma orderBy from sort key
  let orderBy: Prisma.LeadOrderByWithRelationInput =
    definition.label === "Web Leads" ? { createdAt: "desc" } : { contactName: "asc" };
  if (sort && SORT_MAP[sort]) {
    if (sort === "ownerFullName") {
      orderBy = { assignedTo: { name: dir } };
    } else {
      const key = Object.keys(SORT_MAP[sort])[0] as keyof Prisma.LeadOrderByWithRelationInput;
      orderBy = { [key]: dir } as Prisma.LeadOrderByWithRelationInput;
    }
  }

  const display = params.display === "kanban" ? "kanban" : "table";

  if (display === "kanban") {
    // Board columns = the top real statuses under the current filters.
    const statusGroups = await prisma.lead.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    });
    const columns = await Promise.all(
      statusGroups.map(async (g) => {
        const cards = await prisma.lead.findMany({
          where: { ...where, status: g.status },
          orderBy,
          take: 12,
          select: { id: true, contactName: true, businessName: true, totalDebtEst: true },
        });
        return {
          value: g.status,
          label: g.status,
          count: g._count.id,
          cards: cards.map((l) => ({
            id: l.id,
            title: l.contactName || l.businessName || "(no name)",
            sub: l.businessName,
            amount: l.totalDebtEst ? `$${l.totalDebtEst.toLocaleString()}` : null,
            href: `/leads/${l.id}`,
          })),
        };
      }),
    );
    return (
      <SfListPage
        entity="lead"
        title="Leads"
        subtitle={definition.label}
        count={Math.min(2000, viewIds.length)}
        countCapped={viewIds.length > 2000}
        iconColor="#f88962"
        iconSlug="lead"
        actions={[{ label: "New", href: "/leads/new" }]}
        columns={definition.value === "recent" ? RECENT_COLUMNS : COLUMNS}
        rows={[]}
        pathname="/leads"
        searchQuery={search}
        preservedParams={{ ...(params.view ? { view: params.view } : {}) }}
        views={VIEWS}
        currentView={definition.value}
        viewPicker={<LeadListPicker current={definition.value} userId={myId} /> }
        displayMode="kanban"
        bodyOverride={<KanbanBoard columns={columns} entity="leads" fieldKey="status" />}
        massConfig={{
          entity: "lead",
          statusField: "status",
          statusLabel: "Status",
          statusOptions: LEAD_STATUSES.map((s2) => ({ value: s2, label: s2 })),
        }}
      />
    );
  }

  const allViews = VIEWS;

  // SF caps list-view counts at 2,000 ("2,000+ items"). An exact COUNT(*)
  // over the 7M-row Lead table takes seconds, so probe up to the cap instead.
  const COUNT_CAP = 2000;
  const orderedIds = definition.scope === "recent" && !sort
    ? recentIds.filter(id=>viewIds.some(row=>row.id===id)) : viewIds.map(row=>row.id);
  const pageIds = orderedIds.slice((page-1)*LIMIT,page*LIMIT);
  const leads = await prisma.lead.findMany({
    where: { AND: [scope], id: { in: pageIds } },
    include: { assignedTo: { select: { id:true,name:true,email:true } } },
  });
  leads.sort((a,b)=>pageIds.indexOf(a.id)-pageIds.indexOf(b.id));
  const countCapped = viewIds.length > COUNT_CAP;
  const total = Math.min(COUNT_CAP,viewIds.length);

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
      cells: definition.value === "recent" ? [
        nameDisplay,
        String(sfData.Lead_Id__c || lead.sfId || lead.id),
        lead.businessName || "—",
        lead.phone || "—",
        lead.status,
        lead.source,
        fmtMoney(sfData.Total_Debt_Amount__c ?? lead.totalDebtEst) || "—",
        String((sfData.Owner as {Alias?:string}|undefined)?.Alias || sfData.Owner_Alias__c || "—"),
        subDisposition || "—",
        fmtDateShort(lead.createdAt) || "—",
      ] : [
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

  const subtitle = definition.label;

  return (
    <SfListPage
      entity="lead"
      title="Leads"
      subtitle={subtitle}
      count={total}
      countCapped={countCapped}
      displayMode="table"
      iconColor="#f88962"
      iconSlug="lead"
      actions={[
        { label: "New", href: "/leads/new" },
        { label: "Import" },
        { label: "Change Owner" },
        { label: "Change Status" },
        { label: "Send List Email" },
      ]}
      columns={definition.value === "recent" ? RECENT_COLUMNS : COLUMNS}
      rows={redactSsn(rows)}
      bodyOverride={definition.scope === "recent" && !rows.length && !search ? <div className="border border-[#c9c9c9] bg-white px-6 py-12 text-center"><p className="font-semibold">No recently viewed leads yet</p><p className="mt-2 text-sm text-[#747474]">Open a lead from All Leads to add it to your viewing history.</p><Link href="/leads?view=all" className="mt-4 inline-block text-sm text-[#0176d3]">View All Leads</Link></div> : undefined}
      pathname="/leads"
      sortKey={sort || undefined}
      sortDir={dir}
      searchQuery={search}
      preservedParams={preservedParams}
      views={allViews}
      currentView={definition.value}
        viewPicker={<LeadListPicker current={definition.value} userId={myId} /> }
      page={page}
      pageSize={LIMIT}
      massConfig={{
        entity: "lead",
        statusField: "status",
        statusLabel: "Status",
        statusOptions: LEAD_STATUSES.map((s) => ({ value: s, label: s })),
      }}
    />
  );
}
