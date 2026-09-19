import { notFound } from "next/navigation";
import { buildWhere, type ListFilter } from "@/lib/list-views";
import { recordScope } from "@/lib/record-access";
import { redactSsn } from "@/lib/ssn-privacy";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { canViewArchivedOpportunities } from "@/lib/opportunity-access";
import Link from "next/link";
import {
  SfListPage,
  type SfColumn,
  type SfRow,
} from "@/components/slds/sf-list-page";
import { OPP_STAGES as OPPORTUNITY_STAGES } from "@/lib/sf-canonical";
import { InlineEditCell } from "@/components/lists/inline-edit-cell";
import { KanbanBoard } from "@/components/lists/kanban-board";
import { getInlineConfig } from "@/lib/lists/inline-editable-fields";

// Display labels for opportunity stages — match SF screenshots which show
// title-case ("Working Opportunity") rather than DB enum upper-snake.
const STAGE_LABEL: Record<string, string> = {
  WORKING_OPPORTUNITY: "Working Opportunity",
  WAITING_FOR_AGREEMENTS: "Waiting for Agreements",
  READY_TO_CLOSE: "Ready To Close",
  CONTRACT_SENT: "Contract Sent",
  CONTRACT_SIGNED: "Contract Signed",
  ARCHIVED: "Archived",
  CLOSED_WON_FIRST_PAYMENT: "Closed Won First Payment Pending",
  CLOSED: "Closed",
};
const formatStage = (s: string | null | undefined) =>
  s ? STAGE_LABEL[s] ?? s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

interface OpportunitiesPageProps {
  searchParams: Promise<{
    recordType?: string;
    stage?: string;
    search?: string;
    sort?: string;
    dir?: string;
    view?: string;
    page?: string;
    display?: string;
  }>;
}

const LIMIT = 50;

// SF "All Opportunities" list view describe (2026-06-10). Match columns + order
// verbatim.
const COLUMNS: SfColumn[] = [
  { key: "name", label: "Opportunity Name", width: 220, sortable: true },
  { key: "accountName", label: "Account Name", width: 220, sortable: true },
  { key: "lastModified", label: "Last Modified Date", width: 130, sortable: false },
  { key: "phone", label: "Phone", width: 140, sortable: false },
  { key: "stage", label: "Stage", width: 180, sortable: true },
  { key: "leadSource", label: "Lead Source", width: 140, sortable: false },
  { key: "probability", label: "Probability (%)", width: 110, sortable: false, align: "right" },
  { key: "uccRisk", label: "HIGH UCC RISK", width: 130, sortable: false },
  { key: "ownerFullName", label: "Owner Full Name", width: 150, sortable: true },
];

const SORT_MAP: Record<string, Prisma.OpportunityOrderByWithRelationInput> = {
  name: { name: "asc" },
  accountName: { account: { name: "asc" } },
  stage: { stage: "asc" },
  ownerFullName: { assignedTo: { name: "asc" } },
};

const VIEWS = [
  { value: "recent", label: "Recently Viewed" },
  { value: "all", label: "All Opportunities" },
  { value: "my-open", label: "My Open Opportunities" },
  { value: "this-week", label: "This Week's New" },
  { value: "today-activity", label: "Today's Activity" },
];

function fmtDateShort(input: unknown): string {
  if (!input) return "";
  const s = String(input).trim();
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
}

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  let sort = params.sort ?? "";
  let dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  let view = params.view ?? "recent";
  const requestedView=view;

  const session = await auth();
  const myId = session?.user?.id ?? "";

  const listViews=await prisma.listView.findMany({where:{entity:'Opportunity',isSystem:false,OR:[{isShared:true},{ownerId:myId}]},orderBy:{name:'asc'}});
  const selectedView=listViews.find(v=>`custom:${v.id}`===view);
  if(view.startsWith('custom:')&&!selectedView)notFound();
  if(selectedView){view=selectedView.baseView||'all';if(!sort&&selectedView.sortField){sort=selectedView.sortField;dir=selectedView.sortDir==='desc'?'desc':'asc';}}
  const selectedColumns=Array.isArray(selectedView?.columns)?selectedView.columns.filter((v):v is string=>typeof v==='string'):undefined;
  const where: Prisma.OpportunityWhereInput = { AND: [await recordScope("opportunity")], };
  if (params.recordType) where.recordType = params.recordType;
  if (params.stage) where.stage = params.stage;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { account: { is: { name: { contains: search } } } },
    ];
  }

  const recentRows=view==='recent'?await prisma.recordViewHistory.findMany({where:{userId:myId,entity:'opportunity'},orderBy:{viewedAt:'desc'},take:100,select:{recordId:true}}):[];
  const recentIds=recentRows.map(r=>r.recordId);
  if(view==='recent')where.id={in:recentIds};
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (view === "my-open" && myId) {
    where.assignedToId = myId;
    where.stage = { notIn: ["Closed", "Closed Won", "CLOSED", "CLOSED_WON_FIRST_PAYMENT", "ARCHIVED", "Closed Won First Payment Pending", "Closed Won - First Payment Completed", "Closed Lost", "Archive Disposition", "Archived"] };
  } else if (view?.startsWith("owner:")) {
    // Admin drill-down: everything a specific user owns.
    where.assignedToId = view.slice("owner:".length);
  } else if (view === "this-week") {
    where.createdAt = { gte: weekStart };
  } else if (view === "today-activity") {
    where.updatedAt = { gte: todayStart, lt: tomorrow };
  }

  // Closers don't see archived opportunities (unless granted Opportunity.ViewArchived).
  if (!(await canViewArchivedOpportunities(myId))) {
    if (params.stage === "ARCHIVED") where.stage = { in: [] };
    else if (where.stage == null) where.stage = { not: "ARCHIVED" };
  }

  if(selectedView)where.AND=[...(Array.isArray(where.AND)?where.AND:[where.AND??{}]),buildWhere((selectedView.filters??[]) as unknown as ListFilter[])];
  let orderBy: Prisma.OpportunityOrderByWithRelationInput = { updatedAt: "desc" };
  if (sort && SORT_MAP[sort]) {
    if (sort === "accountName") {
      orderBy = { account: { name: dir } };
    } else if (sort === "ownerFullName") {
      orderBy = { assignedTo: { name: dir } };
    } else {
      const key = Object.keys(SORT_MAP[sort])[0] as keyof Prisma.OpportunityOrderByWithRelationInput;
      orderBy = { [key]: dir } as Prisma.OpportunityOrderByWithRelationInput;
    }
  }

  if (params.display === "kanban") {
    const stageGroups = await prisma.opportunity.groupBy({
      by: ["stage"],
      where,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 9,
    });
    const columns = await Promise.all(
      stageGroups.map(async (g) => {
        const cards = await prisma.opportunity.findMany({
          where: { ...where, stage: g.stage },
          orderBy: { updatedAt: "desc" },
          take: 12,
          select: { id: true, name: true, currentTotalDebt: true, account: { select: { name: true } } },
        });
        return {
          value: g.stage,
          label: g.stage.replace(/_/g, " "),
          count: g._count.id,
          cards: cards.map((o) => ({
            id: o.id,
            title: o.name ?? "(unnamed)",
            sub: o.account?.name ?? null,
            amount: o.currentTotalDebt != null ? `$${o.currentTotalDebt.toLocaleString()}` : null,
            href: `/opportunities/${o.id}`,
          })),
        };
      }),
    );
    return (
      <SfListPage
      preferenceUserId={myId}
        entity="opportunity"
        title="Opportunities"
        subtitle={VIEWS.find((v) => v.value === view)?.label ?? "Recently Viewed"}
        count={columns.reduce((s2, c) => s2 + c.count, 0)}
        iconColor="#fcb95b"
        iconSlug="opportunity"
        actions={[{ label: "New" }]}
        columns={COLUMNS}
        selectedColumns={selectedColumns}
      rows={[]}
        pathname="/opportunities"
        searchQuery={search}
        preservedParams={{ ...(params.view ? { view: params.view } : {}) }}
        views={VIEWS}
        currentView={requestedView}
        displayMode="kanban"
        bodyOverride={<KanbanBoard columns={columns} entity="opportunities" fieldKey="stage" />}
        massConfig={{
          entity: "opportunity",
          statusField: "stage",
          statusLabel: "Stage",
          statusOptions: OPPORTUNITY_STAGES.map((s2) => ({
            value: s2,
            label: s2.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          })),
        }}
      />
    );
  }

  // Per-rep owner views (SF per-person lists) - searchable in the picker.
  const ownerUsers = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const ownerViews = ownerUsers.map((u) => ({ value: `owner:${u.id}`, label: u.name }));
  const allViews = [...VIEWS, ...ownerViews,...listViews.map(v=>({value:`custom:${v.id}`,label:v.name}))];

  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      select: {
        id: true,
        name: true,
        stage: true,
        leadSource: true,
        probability: true,
        highUccRisk: true,
        sfDataJson: true,
        updatedAt: true,
        account: { select: { id: true, name: true, highUccRisk: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy,
      skip: view==='recent'&&!sort?0:(page - 1) * LIMIT,
      take: view==='recent'&&!sort?100:LIMIT,
    }),
    prisma.opportunity.count({ where }),
  ]);
  if(view==='recent'&&!sort){items.sort((a,b)=>recentIds.indexOf(a.id)-recentIds.indexOf(b.id));items.splice(page*LIMIT);items.splice(0,(page-1)*LIMIT);}


  const rows: SfRow[] = items.map((o) => {
    let sfData: Record<string, unknown> = {};
    if (o.sfDataJson) {
      try { sfData = JSON.parse(o.sfDataJson) as Record<string, unknown>; } catch { /* ignore */ }
    }

    const oppName = o.name ?? o.account?.name ?? "(no name)";
    const accountName = o.account?.name ?? "—";

    // SF Phone__c is a custom phone field on Opportunity (denormalized from
    // primary contact / lead). Live entirely in sfDataJson.
    const phone = (typeof sfData.Phone__c === "string" ? sfData.Phone__c : "") || "";

    const leadSource =
      (typeof sfData.LeadSource === "string" ? sfData.LeadSource : "") ||
      o.leadSource ||
      "";

    const probabilityNum =
      typeof sfData.Probability === "number"
        ? sfData.Probability
        : typeof o.probability === "number"
          ? o.probability
          : null;
    const probability = probabilityNum != null ? `${probabilityNum}%` : "";

    // SF puts HIGH UCC RISK on Opportunity, but the instructions ask us to read
    // the Account flag (we display either; Account first, Opp as fallback).
    const isHighUcc = o.account?.highUccRisk === true || o.highUccRisk === true;
    const uccCell = isHighUcc ? (
      <span key="ucc" style={{ color: "#c23934", fontWeight: 600 }}>Yes</span>
    ) : "—";

    const ownerFullName =
      o.assignedTo?.name ||
      (typeof sfData.Owner_Full_Name__c === "string" ? sfData.Owner_Full_Name__c : "") ||
      o.assignedTo?.email ||
      "";

    const nameCfg = getInlineConfig("opportunity", "name");
    const stageCfg = getInlineConfig("opportunity", "stage");

    return {
      id: o.id,
      href: `/opportunities/${o.id}`,
      cells: [
        nameCfg ? (
          <InlineEditCell key="name" entity="opportunity" recordId={o.id} config={nameCfg} value={o.name} display={oppName} />
        ) : oppName,
        o.account ? (
          <Link
            key="acct"
            href={`/accounts/${o.account.id}`}
            style={{ color: "#0176d3", textDecoration: "none" }}
            className="sf-row-link"
          >
            {accountName}
          </Link>
        ) : (
          "—"
        ),
        fmtDateShort(o.updatedAt) || "—",
        phone ? (
          <a key="phone" href={`tel:${phone}`} style={{ color: "#0176d3", textDecoration: "none" }}>
            {phone}
          </a>
        ) : "—",
        stageCfg ? (
          <InlineEditCell key="stage" entity="opportunity" recordId={o.id} config={stageCfg} value={o.stage} display={formatStage(o.stage)} />
        ) : formatStage(o.stage),
        leadSource || "—",
        probability || "—",
        uccCell,
        ownerFullName || "—",
      ],
    };
  });

  const preservedParams: Record<string, string> = {};
  if (params.recordType) preservedParams.recordType = params.recordType;
  if (params.stage) preservedParams.stage = params.stage;
  if (params.view) preservedParams.view = params.view;

  const subtitle = selectedView?.name ?? (params.stage
    ? params.stage
    : VIEWS.find((v) => v.value === view)?.label ?? "Recently Viewed");

  return (
    <SfListPage
      preferenceUserId={myId}
      entity="opportunity"
      title="Opportunities"
      subtitle={subtitle}
      count={total}
      displayMode="table"
      iconColor="#fcb95b"
      iconSlug="opportunity"
      actions={[
        { label: "New" },
        { label: "Pipeline Inspection" },
        { label: "Assign Label" },
        { label: "Mass Update" },
      ]}
      columns={COLUMNS}
      selectedColumns={selectedColumns}
      rows={redactSsn(rows)}
      pathname="/opportunities"
      sortKey={sort || undefined}
      sortDir={dir}
      searchQuery={search}
      preservedParams={preservedParams}
      views={allViews}
      currentView={requestedView}
      page={page}
      pageSize={LIMIT}
      massConfig={{
        entity: "opportunity",
        statusField: "stage",
        statusLabel: "Stage",
        statusOptions: OPPORTUNITY_STAGES.map((s) => ({
          value: s,
          label: s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        })),
      }}
    />
  );
}
