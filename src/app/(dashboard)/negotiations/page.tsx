import { negotiationEligibilityWhere } from "@/lib/negotiation-eligibility";
import "./negotiations.css";
import { ListView } from "@/components/slds/list-view";
import styles from "@/components/slds/lightning-list.module.css";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { recordScope } from "@/lib/record-access";
import type { Prisma } from "@/generated/prisma/client";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export default async function NegotiationsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const scope = await recordScope("opportunity");
  const where: Prisma.OpportunityWhereInput = {
    AND: [scope, negotiationEligibilityWhere()], debts: { some: {} },
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { account: { is: { name: { contains: q, mode: "insensitive" } } } },
      { debts: { some: { creditorName: { contains: q, mode: "insensitive" } } } },
    ] } : {}),
  };
  const total = await prisma.opportunity.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / 30));
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(params.page) || 1)));
  const opportunities = await prisma.opportunity.findMany({
    where, take: 30, skip: (page - 1) * 30,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true, name: true, stage: true, account: { select: { name: true } },
      assignedTo: { select: { name: true } },
      debts: { select: { currentBalance: true, negotiationStatus: true, status: true } },
    },
  });
  function href(page: number) { return `/negotiations?${new URLSearchParams({ q, page: String(page) })}`; }
  return (
    <ListView
      entity="Opportunity" entityLabel="Negotiations" viewName="Closed Won · Active Accounts"
      totalCount={total} rows={opportunities} rowOffset={(page - 1) * 30}
      rowHref={opp => `/negotiations/${opp.id}`}
      toolbar={<form className={styles.searchForm} action="/negotiations">
        <input type="search" name="q" defaultValue={q} aria-label="Search negotiations" placeholder="Opportunity, account, or creditor" className="slds-input" />
        <button type="submit">Search</button>
        <Link href="/negotiations">Clear</Link>
      </form>}
      columns={[
        {key: "name", label: "Opportunity", width: 240, render: opp => opp.name || "Unnamed opportunity"},
        {key: "account", label: "Account", width: 240, render: opp => opp.account?.name ?? "—"},
        {key: "owner", label: "Owner", width: 160, render: opp => opp.assignedTo?.name ?? "Unassigned"},
        {key: "stage", label: "Opportunity Stage", width: 220, render: opp => opp.stage},
        {key: "debts", label: "Debts", width: 80, render: opp => opp.debts.length},
        {key: "balance", label: "Balance", width: 150, render: opp => money(opp.debts.reduce((sum, debt) => sum + debt.currentBalance, 0))},
        {key: "open", label: "Actions", width: 160, render: opp => <Link href={`/negotiations/${opp.id}`}>Open negotiations</Link>},
      ]}
      footer={<div className="flex items-center justify-between gap-3">
        <span>Page {page} of {pageCount}</span>
        <div className="flex gap-4">
          {page > 1 && <Link href={href(page - 1)}>Previous</Link>}
          {page < pageCount && <Link href={href(page + 1)}>Next</Link>}
        </div>
      </div>}
    />
  );
}
