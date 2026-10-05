import { prisma } from "@/lib/prisma";
import { ListView } from "@/components/slds/list-view";
import styles from "@/components/slds/lightning-list.module.css";

interface CreditorsPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CreditorsPage({ searchParams }: CreditorsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { legalName: { contains: q, mode: "insensitive" } },
      { account: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const creditors = await prisma.creditor.findMany({
    where,
    include: {
      account: { select: { id: true, name: true, phone: true, email: true } },
      _count: { select: { debts: true } },
    },
    orderBy: { legalName: "asc" },
  });

  return (
    <ListView
      entity="Creditor" entityLabel="Creditors" viewName="All Creditors"
      totalCount={creditors.length} rows={creditors}
      rowHref={(c) => `/accounts/${c.account.id}`}
      toolbar={<form className={styles.searchForm} method="GET" action="/creditors">
        <input type="search" name="q" aria-label="Search creditors" defaultValue={q ?? ""} placeholder="Search this list..." className="slds-input" />
        <button type="submit">Search</button>
      </form>}
      columns={[
        {key: "name", label: "Creditor", width: 240, render: c => c.account.name},
        {key: "legalName", label: "Legal Name", width: 240, render: c => c.legalName},
        {key: "collections", label: "Collections", width: 220, render: c => c.collectionsPhone ?? c.collectionsEmail ?? "—"},
        {key: "debts", label: "Debts", width: 100, render: c => c._count.debts},
        {key: "average", label: "Average Accepted", width: 150, render: c => c.averageAcceptedPercent ? `${(c.averageAcceptedPercent * 100).toFixed(0)}%` : "—"},
      ]}
    />
  );
}
