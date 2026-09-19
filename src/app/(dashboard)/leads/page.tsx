import type { ReactNode } from "react";
import { LEAD_COLUMNS, leadColumnsForView } from "@/lib/lead-list-columns";
import { notFound } from "next/navigation";
import type { ListFilter } from "@/lib/list-views";
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
  type SfRow,
} from "@/components/slds/sf-list-page";
import { LEAD_STATUSES } from "@/lib/sf-canonical";
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
  let sort = params.sort ?? "";
  let dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const page = Math.min(40, Math.max(1, parseInt(params.page ?? "1", 10) || 1));
  const view = params.view === "my-open" ? "my-leads" : params.view ?? "recent";


  const session = await auth();
  const myId = session?.user?.id ?? "";

  const savedViews = await prisma.listView.findMany({where:{entity:'Lead',isSystem:false,OR:[{isShared:true},{ownerId:myId}]},orderBy:{name:'asc'}});
  const selectedView = savedViews.find(v=>`custom:${v.id}`===view);
  if(view.startsWith('custom:')&&!selectedView)notFound();
  const base = VIEWS.find(v=>v.value===(selectedView?.baseView||view)) ?? VIEWS.find(v=>v.value==='all')!;
  const definition = selectedView ? {...base,value:view,label:selectedView.name} : base;
  const allViews = [...VIEWS,...savedViews.map(v=>({...base,value:`custom:${v.id}`,label:v.name}))];
  if(!sort&&selectedView?.sortField){sort=selectedView.sortField;dir=selectedView.sortDir==='desc'?'desc':'asc';}
  const selectedColumns=Array.isArray(selectedView?.columns)?selectedView.columns.filter((v):v is string=>typeof v==='string'):undefined;
  const scope = await recordScope("lead");
  const where: Prisma.LeadWhereInput = { AND: [scope] };
  const recent = await prisma.leadViewHistory.findMany({where:{userId:myId},orderBy:{viewedAt:"desc"},take:100,select:{leadId:true}});
  const recentIds = recent.map(r=>r.leadId);
  const viewIds = await prisma.$queryRaw<Array<{id:string}>>(leadListIdsQuery({
    ...params, search, sort, dir, definition:base, scope, userId:myId, recentIds, savedFilters:(selectedView?.filters??[]) as unknown as ListFilter[],
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
      preferenceUserId={myId}
        entity="lead"
        title="Leads"
        subtitle={definition.label}
        count={Math.min(2000, viewIds.length)}
        countCapped={viewIds.length > 2000}
        iconColor="#f88962"
        iconSlug="lead"
        actions={[{ label: "New", href: "/leads/new" }]}
        columns={LEAD_COLUMNS}
        selectedColumns={selectedColumns ?? leadColumnsForView(base.label)}
        rows={[]}
        pathname="/leads"
        searchQuery={search}
        preservedParams={{ ...(params.view ? { view: params.view } : {}) }}
        views={allViews}
        currentView={definition.value}
        viewPicker={<LeadListPicker current={definition.value} userId={myId} views={allViews} /> }
        displayMode="kanban"
        bodyOverride={<KanbanBoard columns={columns} entity="leads" fieldKey="status" />}
        massConfig={{
          entity: "lead",
          statusField: "status",
          statusLabel: "Status",
          statusOptions: LEAD_STATUSES.filter(s=>s!=="Converted").map((s2) => ({ value: s2, label: s2 })),
        }}
      />
    );
  }


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
      (typeof sfData.Lead_Vendor_Id_Text__c === "string" ? sfData.Lead_Vendor_Id_Text__c : "") ||
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
    const value = (key: string): string => {
      const v = sfData[key];
      return v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "True" : "False") : String(v);
    };
    const cells: Record<string, ReactNode> = {
      debtDetails: value('Debt_Details__c'), createdByAlias: String((sfData.CreatedBy as {Alias?:string}|undefined)?.Alias || "—"),
      name: nameCfg ? <InlineEditCell entity="lead" recordId={lead.id} config={nameCfg} value={lead.contactName} display={nameDisplay} /> : nameDisplay,
      estimatedTotalDebt: estimatedDebt || "—",
      lastModified: fmtDateShort(lead.updatedAt) || "—",
      lastContacted: lastContacted || "—",
      phone: phoneCfg ? <InlineEditCell entity="lead" recordId={lead.id} config={phoneCfg} value={lead.phone} /> : lead.phone || "—",
      state: stateVal || "—", timezone: timezone || "—",
      status: statusCfg ? <InlineEditCell entity="lead" recordId={lead.id} config={statusCfg} value={lead.status} /> : lead.status,
      subDisposition: subDisposition || "—", leadVendor: leadVendor || "—",
      leadVendorText: String(sfData.Lead_Vendor_Id_Text__c ?? sfData.Lead_Vendor_ID_Text__c ?? lead.leadVendorId ?? "—"),
      source: sourceCfg ? <InlineEditCell entity="lead" recordId={lead.id} config={sourceCfg} value={lead.source} /> : lead.source,
      fronter: fronter || "—", ownerFullName: ownerFullName || "—",
      createdDate: fmtDateShort(lead.createdAt) || "—", firstEmail: fmtDateShort((sfData.ActivityMetric as {FirstEmailDateTime?:string}|undefined)?.FirstEmailDateTime ?? sfData.FirstEmailDateTime) || "—",
      leadId: String(sfData.Lead_Id__c || lead.sfId || lead.id), company: lead.businessName || "—",
      totalDebt: fmtMoney(sfData.Total_Debt_Amount__c ?? lead.totalDebtEst) || "—",
      ownerAlias: String((sfData.Owner as {NameOrAlias?:string}|undefined)?.NameOrAlias || (sfData.Owner as {Alias?:string}|undefined)?.Alias || sfData.Owner_Alias__c || "—"),
      email: lead.email || "—", unread: value('IsUnreadByOwner'), calendly: value('Has_Calendly_Event__c'),
      five9Disposition: value('five9_Disposition__c'), adClickId: lead.adClickId || value('Ad_Click_Id__c'),
      trackitClickId: value('Eli_Ad_click__c'), lastDisposition: value('Last_Disposition__c'),
      lenderExternalId: value('MCA_Lender_External_Id__c'), sourceCategory: value('Lead_Source_Category__c'),
      ownerUsername: String(sfData.Owner_Username__c || (sfData.Owner as {Username?:string}|undefined)?.Username || lead.assignedTo?.email || "—"),
      modifiedByAlias: String((sfData.LastModifiedBy as {Alias?:string}|undefined)?.Alias || "—"),
      addToFive9: value('Add_to_f9list_Id__c'), closer: value('Closer__c'),
      lastSubDisposition: value('Last_Sub_Disposition__c'), five9LastDisposition: value('five9_Last_Disposition__c'),
      converted: value('IsConverted'), language: value('Preferred_Language__c'),
      formattedPhone: value('Formated_Phone__c'), utmTerm: lead.utmTerm || value('UTM_Term__c'), dialerGroup: value('Dialer_Group__c'),
    };
    return { id: lead.id, href: `/leads/${lead.id}`, cells: LEAD_COLUMNS.map(column => cells[column.key] ?? "—") };
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
      preferenceUserId={myId}
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
        { label: "Import", href: "/leads/import" },
        { label: "Add to Campaign" },
        { label: "Change Owner" },
        { label: "Change Status" },
        { label: "Send List Email" },
      ]}
      columns={LEAD_COLUMNS}
      selectedColumns={selectedColumns ?? leadColumnsForView(base.label)}
      rows={redactSsn(rows)}
      bodyOverride={definition.scope === "recent" && !rows.length && !search ? <div className="border border-[#c9c9c9] bg-white px-6 py-12 text-center"><p className="font-semibold">No recently viewed leads yet</p><p className="mt-2 text-sm text-[#747474]">Open a lead from All Leads to add it to your viewing history.</p><Link href="/leads?view=all" className="mt-4 inline-block text-sm text-[#0176d3]">View All Leads</Link></div> : undefined}
      pathname="/leads"
      sortKey={sort || undefined}
      sortDir={dir}
      searchQuery={search}
      preservedParams={preservedParams}
      views={allViews}
      currentView={definition.value}
        viewPicker={<LeadListPicker current={definition.value} userId={myId} views={allViews} /> }
      page={page}
      pageSize={LIMIT}
      massConfig={{
        entity: "lead",
        statusField: "status",
        statusLabel: "Status",
        statusOptions: LEAD_STATUSES.filter(s=>s!=="Converted").map((s) => ({ value: s, label: s })),
      }}
    />
  );
}
