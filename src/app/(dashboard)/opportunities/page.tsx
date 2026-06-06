import { prisma } from "@/lib/prisma";
import { SfListPage, ownerAlias, type SfColumn, type SfListViewOption } from "@/components/slds/sf-list-page";

interface OpportunitiesPageProps {
  searchParams: Promise<{ view?: string }>;
}

type OppRow = {
  id: string;
  sfId: string | null;
  name: string | null;
  stage: string;
  totalDebt: number | null;
  expectedCloseDate: string | null;
  account: { id: string; name: string } | null;
  assignedTo: { id: string; name: string; email: string } | null;
  lead: { id: string; sfId: string | null } | null;
};

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const params = await searchParams;
  const view = params.view ?? "";

  const where: Record<string, unknown> = {};

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
      orderBy: view === "all_opportunities"
        ? { name: "asc" }
        : { updatedAt: "desc" },
      take: 50,
    }),
    prisma.opportunity.count({ where }),
  ]);

  const rows: OppRow[] = items.map((o) => ({
    id: o.id,
    sfId: o.sfId,
    name: o.name,
    stage: o.stage,
    totalDebt: o.totalDebt,
    expectedCloseDate: o.expectedCloseDate ? o.expectedCloseDate.toISOString() : null,
    account: o.account,
    assignedTo: o.assignedTo,
    lead: o.lead,
  }));

  const columns: SfColumn<OppRow>[] = [
    {
      key: "name",
      label: "Opportunity Name",
      render: (o) => o.name ?? o.account?.name ?? "(no name)",
      sortValue: (o) => o.name ?? o.account?.name ?? "",
      searchText: (o) => o.name ?? o.account?.name,
    },
    {
      key: "account",
      label: "Account Name",
      render: (o) => o.account?.name ?? "",
      sortValue: (o) => o.account?.name,
      searchText: (o) => o.account?.name,
    },
    {
      key: "stage",
      label: "Stage",
      render: (o) => o.stage,
      sortValue: (o) => o.stage,
      searchText: (o) => o.stage,
    },
    {
      key: "closeDate",
      label: "Close Date",
      render: (o) =>
        o.expectedCloseDate
          ? new Date(o.expectedCloseDate).toLocaleDateString("en-US")
          : "",
      sortValue: (o) => o.expectedCloseDate ?? "",
    },
    {
      key: "totalDebt",
      label: "Total Debt Including Fees",
      align: "left",
      render: (o) =>
        o.totalDebt != null
          ? `$${o.totalDebt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "",
      sortValue: (o) => o.totalDebt ?? 0,
    },
    {
      key: "leadId",
      label: "Lead Id",
      render: (o) => (o.lead?.sfId ?? (o.lead?.id ? o.lead.id.slice(-7) : "")),
      sortValue: (o) => o.lead?.sfId ?? o.lead?.id ?? "",
      searchText: (o) => o.lead?.sfId,
    },
    {
      key: "oppId",
      label: "Opp ID",
      render: (o) => o.sfId ?? o.id.slice(-7),
      sortValue: (o) => o.sfId ?? o.id,
      searchText: (o) => o.sfId,
    },
    {
      key: "ownerAlias",
      label: "Owner Alias",
      render: (o) => (
        <span style={{ color: "#1589ee" }}>{ownerAlias(o.assignedTo)}</span>
      ),
      sortValue: (o) => ownerAlias(o.assignedTo),
      searchText: (o) => ownerAlias(o.assignedTo),
    },
  ];

  const views: SfListViewOption[] = [
    { label: "Recently Viewed", value: "", active: view === "" },
    { label: "All Opportunities", value: "all_opportunities", active: view === "all_opportunities" },
    { label: "My Opportunities", value: "my_opportunities", active: view === "my_opportunities" },
    { label: "Closing This Month", value: "closing_this_month", active: view === "closing_this_month" },
  ];

  return (
    <SfListPage
      entity="opportunity"
      iconSlug="opportunity"
      iconColor="#fcb95b"
      title="Opportunities"
      subtitle={views.find((v) => v.active)?.label ?? "Recently Viewed"}
      count={total}
      actions={[
        { label: "New", href: "/opportunities/new" },
        { label: "Change Owner" },
        { label: "Change Stage" },
        { label: "Send Email" },
      ]}
      rowHref={(o) => `/opportunities/${o.id}`}
      columns={columns}
      rows={rows}
      views={views}
    />
  );
}
