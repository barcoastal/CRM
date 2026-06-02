import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { opportunityStageTone } from "@/lib/slds/status-tones";

interface OpportunitiesPageProps {
  searchParams: Promise<{ recordType?: string; stage?: string }>;
}

type OppRow = {
  id: string;
  recordType: string;
  stage: string;
  totalDebt: number | null;
  expectedCloseDate: Date | null;
  account: { id: string; name: string } | null;
  primaryContact: { id: string; fullName: string } | null;
  assignedTo: { id: string; name: string } | null;
};

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const params = await searchParams;
  const where: Record<string, unknown> = {};
  if (params.recordType) where.recordType = params.recordType;
  if (params.stage) where.stage = params.stage;

  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: {
        account: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.opportunity.count({ where }),
  ]);

  const columns: ListViewColumn<OppRow>[] = [
    {
      key: "name",
      label: "Opportunity Name",
      render: (o) => o.account?.name ?? "(no account)",
    },
    {
      key: "product",
      label: "Product",
      render: (o) => o.recordType.replace(/_/g, " "),
    },
    {
      key: "stage",
      label: "Stage",
      render: (o) => <StatusPill label={o.stage} tone={opportunityStageTone(o.stage)} />,
    },
    {
      key: "debt",
      label: "Total Debt",
      render: (o) => (o.totalDebt ? `$${o.totalDebt.toLocaleString()}` : "—"),
    },
    {
      key: "contact",
      label: "Primary Contact",
      render: (o) => o.primaryContact?.fullName ?? "—",
    },
    {
      key: "close",
      label: "Close Date",
      render: (o) => o.expectedCloseDate?.toLocaleDateString() ?? "—",
    },
    {
      key: "owner",
      label: "Owner",
      render: (o) => o.assignedTo?.name ?? "—",
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
