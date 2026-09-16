import "../negotiations.css";
import { ObjectHeader } from "@/components/slds/object-header";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recordScope, canAccessRecord } from "@/lib/record-access";
import { OpportunityNegotiations } from "@/components/opportunities/opportunity-negotiations";

export default async function NegotiationOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await recordScope("opportunity");
  const opp = await prisma.opportunity.findFirst({
    where: { id, AND: [scope] },
    include: { account: { select: { name: true } }, documents: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, type: true, fileSize: true, createdAt: true } }, assignedTo: { select: { name: true } },
      debts: { orderBy: { creditorName: "asc" }, include: {
        creditor: { select: { collectionsEmail: true, collectionsPhone: true } },
        sourceDocument: { select: { id: true, name: true, type: true, fileSize: true, createdAt: true } },
        offers: { orderBy: { createdAt: "desc" }, take: 30 },
        negotiations: { include: { negotiator: { select: { id: true, name: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      } },
    },
  });
  if (!opp) notFound();
  const session = await auth();
  const canEmail = !!session?.user?.id && hasPermission(session.user.permissions ?? [], "Email.Send");
  const linkedEmails = canEmail ? await prisma.emailMessage.findMany({
    where: { opportunityId: id, ownerId: session!.user.id }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, subject: true, fromAddress: true, toAddresses: true, direction: true, status: true, createdAt: true, threadId: true, bodyText: true, bodyHtml: true, attachments: { select: { id: true, filename: true } } },
  }) : [];
  const threadIds = [...new Set(linkedEmails.map(email => email.threadId || email.id))];
  const threadEmails = canEmail && threadIds.length ? await prisma.emailMessage.findMany({
    where: { ownerId: session!.user.id, threadId: { in: threadIds }, OR: [{ opportunityId: id }, { opportunityId: null }] },
    orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, subject: true, fromAddress: true, toAddresses: true, direction: true, status: true, createdAt: true, threadId: true, bodyText: true, bodyHtml: true, attachments: { select: { id: true, filename: true } } },
  }) : [];
  const emails = [...new Map([...linkedEmails, ...threadEmails].map(email => [email.id, email])).values()].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
  const relatedWhere: { accountId?: string; leadId?: string }[] = [];
  if (opp.accountId && await canAccessRecord("account", opp.accountId)) relatedWhere.push({ accountId: opp.accountId });
  if (opp.leadId && await canAccessRecord("lead", opp.leadId)) relatedWhere.push({ leadId: opp.leadId });
  const relatedDocuments = relatedWhere.length ? await prisma.document.findMany({ where: { OR: relatedWhere }, select: { id: true, name: true, type: true, fileSize: true, createdAt: true, accountId: true, leadId: true }, orderBy: { createdAt: "desc" } }) : [];
  const documents = [...new Map([...(opp.documents ?? []).map(doc => ({ ...doc, origin: "Opportunity" })), ...relatedDocuments.map(doc => ({ ...doc, origin: doc.leadId && doc.leadId === opp.leadId ? "Lead" : "Account" }))].map(doc => [doc.id, doc])).values()];
  return <div className="ng-page">
    <Link href="/negotiations" className="ng-back">‹ Negotiations</Link>
    <ObjectHeader entity="Opportunity" entityLabel="Negotiations" recordTitle={opp.name || "Opportunity negotiations"} highlights={[
      { label: "Account", value: opp.account?.name ?? "—" },
      { label: "Opportunity Owner", value: opp.assignedTo?.name ?? "Unassigned" },
      { label: "Debts", value: String(opp.debts.length) },
      { label: "Total Balance", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(opp.debts.reduce((sum, debt) => sum + debt.currentBalance, 0)) },
    ]} actions={<Link href={`/opportunities/${opp.id}`} className="ng-button">View opportunity</Link>} />
      <OpportunityNegotiations canCreateOffer={hasPermission(session?.user?.permissions ?? [], "Offer.Create")} documents={documents.map((doc) => ({ ...doc, createdAt: doc.createdAt.toISOString() }))} canEmail={canEmail} senderEmail={session?.user?.email ?? ""} emails={emails.map((email) => ({ ...email, createdAt: email.createdAt.toISOString() }))} opportunityName={opp.name ?? "Opportunity"} opportunityId={opp.id} debts={opp.debts.map((debt) => ({
        creditorEmail: debt.creditorEmail || debt.creditor?.collectionsEmail || null, id: debt.id, creditorName: debt.creditorName, accountNumber: debt.accountNumber,
        originalBalance: debt.originalBalance, enrolledBalance: debt.enrolledBalance, creditorPhone: debt.creditorPhone || debt.creditor?.collectionsPhone,
        debtType: debt.debtType, paymentAmount: debt.paymentAmount, paymentFrequency: debt.paymentFrequency, legalStatus: debt.legalStatus, lienPosition: debt.lienPosition, isDelinquent: debt.isDelinquent, notes: debt.notes, settledAmount: debt.settledAmount,
        sourceDocument: debt.sourceDocument ? { ...debt.sourceDocument, createdAt: debt.sourceDocument.createdAt.toISOString() } : null,
        offers: debt.offers.map((offer) => ({ id: offer.id, amountOffered: offer.amountOffered, percentOffered: offer.percentOffered, status: offer.status, termsNotes: offer.termsNotes, createdAt: offer.createdAt.toISOString(), counterAmount: offer.counterAmount })),
        currentBalance: debt.currentBalance, status: debt.status, negotiationStatus: debt.negotiationStatus,
        negotiations: debt.negotiations.map((neg) => ({ ...neg, date: neg.date.toISOString(), createdAt: neg.createdAt.toISOString() })),
      }))} />
  </div>;
}
