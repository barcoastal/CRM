import "../negotiations.css";
import { ObjectHeader } from "@/components/slds/object-header";
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
  return <div className="ng-page">
    <Link href="/negotiations" className="ng-back">‹ Negotiations</Link>
    <ObjectHeader entity="Opportunity" entityLabel="Negotiations" recordTitle={opp.name || "Opportunity negotiations"} highlights={[
      { label: "Account", value: opp.account?.name ?? "—" },
      { label: "Opportunity Owner", value: opp.assignedTo?.name ?? "Unassigned" },
      { label: "Debts", value: String(opp.debts.length) },
      { label: "Total Balance", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(opp.debts.reduce((sum, debt) => sum + debt.currentBalance, 0)) },
    ]} actions={<Link href={`/opportunities/${opp.id}`} className="ng-button">View opportunity</Link>} />
      <OpportunityNegotiations canEmail={canEmail} senderEmail={session?.user?.email ?? ""} emails={emails.map((email) => ({ ...email, createdAt: email.createdAt.toISOString() }))} opportunityName={opp.name ?? "Opportunity"} opportunityId={opp.id} debts={opp.debts.map((debt) => ({
        creditorEmail: debt.creditorEmail || debt.creditor?.collectionsEmail || null, id: debt.id, creditorName: debt.creditorName, accountNumber: debt.accountNumber,
        currentBalance: debt.currentBalance, status: debt.status, negotiationStatus: debt.negotiationStatus,
        negotiations: debt.negotiations.map((neg) => ({ ...neg, date: neg.date.toISOString(), createdAt: neg.createdAt.toISOString() })),
      }))} />
  </div>;
}
