import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import {
  SfListPage,
  type SfColumn,
  type SfRow,
  ownerAlias,
} from "@/components/slds/sf-list-page";

interface OpportunitiesPageProps {
  searchParams: Promise<{
    recordType?: string;
    stage?: string;
    search?: string;
    sort?: string;
    dir?: string;
  }>;
}

const LIMIT = 50;

// SF Opportunity list columns (match docs/sf-screenshots/sf-opp-list.png):
// # | checkbox | Opportunity Name | Account Name | Stage | Close Date |
// Total Debt Including Fees | Lead Id | Opp ID | Owner Alias
const COLUMNS: SfColumn[] = [
  { key: "name", label: "Opportunity Name", width: 240, sortable: true },
  { key: "account", label: "Account Name", width: 220, sortable: true },
  { key: "stage", label: "Stage", width: 200, sortable: true },
  { key: "close", label: "Close Date", width: 110, sortable: true },
  { key: "debt", label: "Total Debt Including Fees", width: 170, sortable: true, align: "right" },
  { key: "leadId", label: "Lead Id", width: 110, sortable: true },
  { key: "oppId", label: "Opp ID", width: 110, sortable: true },
  { key: "ownerAlias", label: "Owner Alias", width: 110, sortable: true },
];

const SORT_MAP: Record<string, Prisma.OpportunityOrderByWithRelationInput> = {
  name: { name: "asc" },
  stage: { stage: "asc" },
  close: { expectedCloseDate: "asc" },
  debt: { totalDebt: "asc" },
};

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? "";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";

  const where: Prisma.OpportunityWhereInput = {};
  if (params.recordType) where.recordType = params.recordType;
  if (params.stage) where.stage = params.stage;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { account: { is: { name: { contains: search } } } },
    ];
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
        account: { select: { id: true, name: true } },
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
        o.stage || "—",
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

  return (
    <SfListPage
      entity="opportunity"
      title="Opportunities"
      subtitle={params.stage ? params.stage : "Recently Viewed"}
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
    />
  );
}
