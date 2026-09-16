import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recordScope } from "@/lib/record-access";
import { OpportunityNegotiations } from "@/components/opportunities/opportunity-negotiations";

export default async function NegotiationOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await recordScope("opportunity");
  const opp = await prisma.opportunity.findFirst({
    where: { id, AND: [scope] },
    include: { account: { select: { name: true } }, assignedTo: { select: { name: true } },
      debts: { orderBy: { creditorName: "asc" }, include: {
        negotiations: { include: { negotiator: { select: { id: true, name: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      } },
    },
  });
  if (!opp) notFound();
  return <div className="space-y-4 p-4">
    <Link href="/negotiations" className="text-sm text-[#0176d3]">← All negotiations</Link>
    <header className="rounded border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">{opp.name || "Opportunity negotiations"}</h1><Link href={`/opportunities/${opp.id}`} className="text-sm text-[#0176d3]">View opportunity record</Link></div>
      <p className="mt-2 text-sm text-muted-foreground">{opp.account?.name ?? "No account"} · Owner: {opp.assignedTo?.name ?? "Unassigned"} · {opp.debts.length} debts</p>
    </header>
    <section className="rounded border bg-white p-4">
      <OpportunityNegotiations opportunityId={opp.id} debts={opp.debts.map((debt) => ({
        id: debt.id, creditorName: debt.creditorName, accountNumber: debt.accountNumber,
        currentBalance: debt.currentBalance, status: debt.status, negotiationStatus: debt.negotiationStatus,
        negotiations: debt.negotiations.map((neg) => ({ ...neg, date: neg.date.toISOString(), createdAt: neg.createdAt.toISOString() })),
      }))} />
    </section>
  </div>;
}
