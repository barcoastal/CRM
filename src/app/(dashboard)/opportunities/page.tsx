import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import Link from "next/link";
import {
  SfListPage,
  type SfColumn,
  type SfRow,
  ownerAlias,
} from "@/components/slds/sf-list-page";
import { OPPORTUNITY_STAGES } from "@/lib/validations/opportunity";

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

// SF Opportunity list columns (match docs/sf-screenshots/sf-opp-list.png):
// # | checkbox | Opportunity Name | Account Name | Stage | Close Date |
// Total Debt Including Fees | Lead Id | Opp ID | Owner Alias
// SF Opportunity list columns (docs/sf-screenshots/sf-opp-list.png):
// # | checkbox | Opportunity Name | Account Name | A...(Account Site) |
// Stage | Close Date | Total Debt Includ... | Lead Id | Opp... |
// Opportunity Owner Alias
const COLUMNS: SfColumn[] = [
  { key: "name", label: "Opportunity Name", width: 240, sortable: true },
  { key: "account", label: "Account Name", width: 220, sortable: true },
  { key: "accountSite", label: "Account Site", width: 110, sortable: false },
  { key: "stage", label: "Stage", width: 200, sortable: true },
  { key: "close", label: "Close Date", width: 110, sortable: true },
  { key: "debt", label: "Total Debt Including Fees", width: 170, sortable: true, align: "right" },
  { key: "leadId", label: "Lead Id", width: 110, sortable: true },
  { key: "oppId", label: "Opp ID", width: 110, sortable: true },
  { key: "ownerAlias", label: "Opportunity Owner Alias", width: 160, sortable: true },
];

const SORT_MAP: Record<string, Prisma.OpportunityOrderByWithRelationInput> = {
  name: { name: "asc" },
  stage: { stage: "asc" },
  close: { expectedCloseDate: "asc" },
  debt: { totalDebt: "asc" },
};

const VIEWS = [
  { value: "recent", label: "Recently Viewed" },
  { value: "all", label: "All Opportunities" },
  { value: "my-open", label: "My Open Opportunities" },
  { value: "this-week", label: "This Week's New" },
  { value: "today-activity", label: "Today's Activity" },
];

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
    const key = Object.keys(SORT_MAP[sort])[0] as keyof Prisma.OpportunityOrderByWithRelationInput;
    orderBy = { [key]: dir } as Prisma.OpportunityOrderByWithRelationInput;
  }

  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      select: {
        id: true,
        sfId: true,
        name: true,
        stage: true,
        totalDebt: true,
        expectedCloseDate: true,
        account: { select: { id: true, name: true, website: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, sfId: true } },
      },
      orderBy,
      take: LIMIT,
    }),
    prisma.opportunity.count({ where }),
  ]);

  const rows: SfRow[] = items.map((o) => {
    const oppName = o.name ?? o.account?.name ?? "(no name)";
    const accountName = o.account?.name ?? "—";
    const closeDate = o.expectedCloseDate
      ? new Date(o.expectedCloseDate).toLocaleDateString("en-US", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
        })
      : "—";
    const debt =
      typeof o.totalDebt === "number"
        ? `$${o.totalDebt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "—";
    const leadIdShort = o.lead
      ? (o.lead.sfId ?? o.lead.id.slice(-8).toUpperCase())
      : "—";
    const oppIdShort = o.sfId ?? o.id.slice(-8).toUpperCase();
    const accountSite = o.account?.website
      ? o.account.website.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")
      : "";
    return {
      id: o.id,
      href: `/opportunities/${o.id}`,
      cells: [
        oppName,
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
        accountSite || "—",
        formatStage(o.stage),
        closeDate,
        debt,
        leadIdShort,
        oppIdShort,
        ownerAlias(o.assignedTo) || "—",
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
