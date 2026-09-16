import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
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
        creditor: { select: { collectionsEmail: true } },
        negotiations: { include: { negotiator: { select: { id: true, name: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      } },
    },
  });
  if (!opp) notFound();
  const session = await auth();
  const canEmail = !!session?.user?.id && hasPermission(session.user.permissions ?? [], "Email.Send");
  const emails = canEmail ? await prisma.emailMessage.findMany({
    where: { opportunityId: id, ownerId: session!.user.id }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, subject: true, fromAddress: true, toAddresses: true, direction: true, status: true, createdAt: true },
  }) : [];
  return <div className="space-y-4 p-4">
    <Link href="/negotiations" className="text-sm text-[#0176d3]">← All negotiations</Link>
    <header className="rounded border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">{opp.name || "Opportunity negotiations"}</h1><Link href={`/opportunities/${opp.id}`} className="text-sm text-[#0176d3]">View opportunity record</Link></div>
      <p className="mt-2 text-sm text-muted-foreground">{opp.account?.name ?? "No account"} · Owner: {opp.assignedTo?.name ?? "Unassigned"} · {opp.debts.length} debts</p>
    </header>
    <section className="rounded border bg-white p-4">
      <OpportunityNegotiations canEmail={canEmail} senderEmail={session?.user?.email ?? ""} emails={emails.map((email) => ({ ...email, createdAt: email.createdAt.toISOString() }))} opportunityName={opp.name ?? "Opportunity"} opportunityId={opp.id} debts={opp.debts.map((debt) => ({
        creditorEmail: debt.creditorEmail || debt.creditor?.collectionsEmail || null, id: debt.id, creditorName: debt.creditorName, accountNumber: debt.accountNumber,
        currentBalance: debt.currentBalance, status: debt.status, negotiationStatus: debt.negotiationStatus,
        negotiations: debt.negotiations.map((neg) => ({ ...neg, date: neg.date.toISOString(), createdAt: neg.createdAt.toISOString() })),
      }))} />
    </section>
  </div>;
}
