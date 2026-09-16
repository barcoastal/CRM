import "./negotiations.css";
import { ObjectHeader } from "@/components/slds/object-header";
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
    AND: [scope], debts: { some: {} },
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
    <div className="ng-page ng-list-page">
      <ObjectHeader entity="Opportunity" entityLabel="Negotiations" recordTitle="Opportunity negotiations" recordSubtitle="Manage creditor conversations and settlement progress." />
      <header className="ng-list-tools">
        <form className="ng-list-search" action="/negotiations">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">Search opportunities
            <input name="q" defaultValue={q} placeholder="Opportunity, account, or creditor" className="rounded border p-2" />
          </label>
          <button className="rounded bg-[#0176d3] px-4 py-2 text-sm text-white" type="submit">Search</button>
          <Link href="/negotiations" className="px-2 py-2 text-sm text-[#0176d3]">Clear</Link>
        </form>
      </header>
      <div className="ng-list-table">
        <p className="border-b p-3 text-sm">{total.toLocaleString()} opportunities · Page {page} of {pageCount}</p>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50"><tr>{["Opportunity", "Account", "Owner", "Opportunity stage", "Debts", "Balance", ""].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{opportunities.map((opp) => <tr key={opp.id} className="border-t">
            <td className="px-4 py-3 font-medium"><Link className="text-[#0176d3]" href={`/negotiations/${opp.id}`}>{opp.name || "Unnamed opportunity"}</Link></td>
            <td className="px-4 py-3">{opp.account?.name ?? "—"}</td>
            <td className="px-4 py-3">{opp.assignedTo?.name ?? "Unassigned"}</td>
            <td className="px-4 py-3">{opp.stage}</td>
            <td className="px-4 py-3">{opp.debts.length}</td>
            <td className="whitespace-nowrap px-4 py-3">{money(opp.debts.reduce((sum, debt) => sum + debt.currentBalance, 0))}</td>
            <td className="px-4 py-3"><Link className="font-medium text-[#0176d3]" href={`/negotiations/${opp.id}`}>Open negotiations</Link></td>
          </tr>)}</tbody>
        </table>
        {!opportunities.length && <p className="p-8 text-center text-sm text-muted-foreground">No accessible opportunities with debts match your search.</p>}
        <div className="flex justify-between border-t p-3 text-sm">
          {page > 1 ? <Link href={href(page - 1)}>Previous</Link> : <span />}
          {page < pageCount && <Link href={href(page + 1)}>Next</Link>}
        </div>
      </div>
    </div>
  );
}
