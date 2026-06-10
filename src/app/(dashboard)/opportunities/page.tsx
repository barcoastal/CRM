import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import Link from "next/link";
import {
  SfListPage,
  type SfColumn,
  type SfRow,
} from "@/components/slds/sf-list-page";
import { OPPORTUNITY_STAGES } from "@/lib/validations/opportunity";
import { InlineEditCell } from "@/components/lists/inline-edit-cell";
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
  const sort = params.sort ?? "";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const view = params.view ?? "recent";

  const session = await auth();
  const myId = session?.user?.id ?? "";

  const where: Prisma.OpportunityWhereInput = {};
  if (params.recordType) where.recordType = params.recordType;
  if (params.stage) where.stage = params.stage;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { account: { is: { name: { contains: search } } } },
    ];
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (view === "my-open" && myId) {
    where.assignedToId = myId;
    where.stage = { notIn: ["CLOSED", "CLOSED_WON_FIRST_PAYMENT", "ARCHIVED"] };
  } else if (view === "this-week") {
    where.createdAt = { gte: weekStart };
  } else if (view === "today-activity") {
    where.updatedAt = { gte: todayStart, lt: tomorrow };
  }

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
      take: LIMIT,
    }),
    prisma.opportunity.count({ where }),
  ]);

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
            style={{ color: "#1589ee", textDecoration: "none" }}
            className="sf-row-link"
          >
            {accountName}
          </Link>
        ) : (
          "—"
        ),
        fmtDateShort(o.updatedAt) || "—",
        phone ? (
          <a key="phone" href={`tel:${phone}`} style={{ color: "#1589ee", textDecoration: "none" }}>
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

  const subtitle = params.stage
    ? params.stage
    : VIEWS.find((v) => v.value === view)?.label ?? "Recently Viewed";

  return (
    <SfListPage
      entity="opportunity"
      title="Opportunities"
      subtitle={subtitle}
      count={total}
      iconColor="#fcb95b"
      iconSlug="opportunity"
      actions={[
        { label: "New" },
        { label: "Pipeline Inspection" },
        { label: "Assign Label" },
        { label: "Mass Update" },
      ]}
      columns={COLUMNS}
      rows={rows}
      pathname="/opportunities"
      sortKey={sort || undefined}
      sortDir={dir}
      searchQuery={search}
      preservedParams={preservedParams}
      views={VIEWS}
      currentView={view}
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
