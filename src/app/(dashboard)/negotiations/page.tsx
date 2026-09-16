import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { recordScope } from "@/lib/record-access";
import { DEBT_STATUSES } from "@/lib/validations/debt";
import { OpportunityNegotiations } from "@/components/opportunities/opportunity-negotiations";
import type { Prisma } from "@/generated/prisma/client";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export default async function NegotiationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; debt?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = DEBT_STATUSES.find((value) => value === params.status);
  const scope = await recordScope("opportunity");
  const where: Prisma.DebtWhereInput = {
    opportunity: { is: scope },
    ...(status ? { status } : {}),
    ...(q ? { OR: [
      { creditorName: { contains: q, mode: "insensitive" } },
      { opportunity: { is: { name: { contains: q, mode: "insensitive" } } } },
      { opportunity: { is: { account: { is: { name: { contains: q, mode: "insensitive" } } } } } },
    ] } : {}),
  };
  const total = await prisma.debt.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / 30));
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(params.page) || 1)));
  const debts = await prisma.debt.findMany({
    where, take: 30, skip: (page - 1) * 30,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    include: {
      opportunity: { select: { id: true, name: true, account: { select: { name: true } } } },
      negotiations: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 1 },
    },
  });
  const selected = params.debt ? await prisma.debt.findFirst({
    where: { id: params.debt, opportunity: { is: scope } },
    include: {
      opportunity: { select: { id: true, name: true } },
      negotiations: { include: { negotiator: { select: { id: true, name: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
    },
  }) : null;
  function href(values: { page?: number; debt?: string }) {
    const query = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(values.page ?? page), ...(values.debt ? { debt: values.debt } : {}) });
    return `/negotiations?${query}${values.debt ? "#negotiation-workspace" : ""}`;
  }
  return (
    <div className="space-y-4 p-4">
      <header className="rounded border bg-white p-5">
        <h1 className="text-2xl font-semibold">Negotiations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage creditor conversations, offers, and counteroffers across opportunities.</p>
        <form className="mt-4 flex flex-wrap items-end gap-3" action="/negotiations">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">Search
            <input name="q" defaultValue={q} placeholder="Creditor, opportunity, or account" className="rounded border p-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">Debt status
            <select name="status" defaultValue={status ?? ""} className="rounded border bg-white p-2">
              <option value="">All statuses</option>
              {DEBT_STATUSES.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
            </select>
          </label>
          <button className="rounded bg-[#0176d3] px-4 py-2 text-sm text-white" type="submit">Search</button>
          <Link href="/negotiations" className="px-2 py-2 text-sm text-[#0176d3]">Clear</Link>
        </form>
      </header>
      <div className="overflow-x-auto rounded border bg-white">
        <p className="border-b p-3 text-sm">{total.toLocaleString()} debts · Page {page} of {pageCount}</p>
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50"><tr>{["Creditor", "Opportunity / Account", "Balance", "Debt status", "Latest response", "Last activity", ""].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{debts.map((debt) => <tr key={debt.id} className={`border-t ${selected?.id === debt.id ? "bg-blue-50" : ""}`}>
            <td className="px-4 py-3 font-medium">{debt.creditorName}</td>
            <td className="px-4 py-3"><Link className="text-[#0176d3]" href={`/opportunities/${debt.opportunity!.id}`}>{debt.opportunity!.name || "View opportunity"}</Link><div className="text-xs text-muted-foreground">{debt.opportunity!.account?.name}</div></td>
            <td className="whitespace-nowrap px-4 py-3">{money(debt.currentBalance)}</td>
            <td className="px-4 py-3">{debt.status.replace(/_/g, " ")}</td>
            <td className="px-4 py-3">{debt.negotiations[0]?.response ?? "Not started"}</td>
            <td className="whitespace-nowrap px-4 py-3">{debt.negotiations[0]?.date.toLocaleDateString("en-US", { timeZone: "UTC" }) ?? "—"}</td>
            <td className="px-4 py-3"><Link className="font-medium text-[#0176d3]" href={href({ debt: debt.id })}>Manage</Link></td>
          </tr>)}</tbody>
        </table>
        {!debts.length && <p className="p-8 text-center text-sm text-muted-foreground">No debts match your filters. Debts linked to opportunities you can access appear here.</p>}
        <div className="flex justify-between border-t p-3 text-sm">
          {page > 1 ? <Link href={href({ page: page - 1 })}>Previous</Link> : <span />}
          {page < pageCount && <Link href={href({ page: page + 1 })}>Next</Link>}
        </div>
      </div>
      {params.debt && !selected && <p role="alert" className="rounded border bg-white p-4 text-sm">This debt is unavailable or you do not have access.</p>}
      {selected?.opportunity && <section id="negotiation-workspace" className="scroll-mt-28 rounded border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{selected.creditorName} · {selected.opportunity.name || "Negotiation activity"}</h2><Link href={href({})} className="text-sm text-[#0176d3]">Close</Link></div>
        <OpportunityNegotiations opportunityId={selected.opportunity.id} debts={[{ id: selected.id, creditorName: selected.creditorName, accountNumber: selected.accountNumber, currentBalance: selected.currentBalance, status: selected.status, negotiations: selected.negotiations.map((neg) => ({ ...neg, date: neg.date.toISOString(), createdAt: neg.createdAt.toISOString() })) }]} />
      </section>}
    </div>
  );
}
