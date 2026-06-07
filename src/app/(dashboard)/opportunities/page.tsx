import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { opportunityStageTone } from "@/lib/slds/status-tones";

interface OpportunitiesPageProps {
  searchParams: Promise<{ recordType?: string; stage?: string }>;
}

type OppRow = {
  id: string;
  sfId: string | null;
  name: string | null;
  recordType: string;
  stage: string;
  totalDebt: number | null;
  expectedCloseDate: Date | null;
  account: { id: string; name: string } | null;
  primaryContact: { id: string; fullName: string } | null;
  assignedTo: { id: string; name: string } | null;
  lead: { id: string } | null;
};

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const params = await searchParams;
  const where: Record<string, unknown> = {};
  if (params.recordType) where.recordType = params.recordType;
  if (params.stage) where.stage = params.stage;

  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      select: {
        id: true,
        sfId: true,
        name: true,
        recordType: true,
        stage: true,
        totalDebt: true,
        expectedCloseDate: true,
        account: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, name: true } },
        lead: { select: { id: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.opportunity.count({ where }),
  ]);

  // SF list columns reference: docs/sf-screenshots/sf-opp-list.png
  // Opportunity Name | Account Name | Stage | Close Date | Total Debt Including Fees | Lead Id | Opp ID | Owner
  const columns: ListViewColumn<OppRow>[] = [
    {
      key: "name",
      label: "Opportunity Name",
      render: (o) => o.name ?? o.account?.name ?? "(no name)",
    },
    {
      key: "account",
      label: "Account Name",
      render: (o) => o.account?.name ?? "-",
    },
    {
      key: "stage",
      label: "Stage",
      render: (o) => <StatusPill label={o.stage} tone={opportunityStageTone(o.stage)} />,
    },
    {
      key: "close",
      label: "Close Date",
      render: (o) => o.expectedCloseDate?.toLocaleDateString() ?? "-",
    },
    {
      key: "debt",
      label: "Total Debt Including Fees",
      render: (o) => (o.totalDebt ? `$${o.totalDebt.toLocaleString()}` : "-"),
    },
    {
      key: "leadId",
      label: "Lead Id",
      render: (o) => (o.lead?.id ? o.lead.id.slice(-8).toUpperCase() : "-"),
    },
    {
      key: "oppId",
      label: "Opp ID",
      render: (o) => (o.sfId ?? o.id.slice(-8).toUpperCase()),
    },
    {
      key: "owner",
      label: "Owner",
      render: (o) => o.assignedTo?.name ?? "-",
    },
  ];

  return (
    <ListView
      entity="Opportunity"
      entityLabel="Opportunities"
      viewName={params.stage ? params.stage : "Recently Viewed"}
      totalCount={total}
      rows={items as OppRow[]}
      columns={columns}
      rowHref={(o) => `/opportunities/${o.id}`}
      newHref="/opportunities/new"
    />
  );
}
