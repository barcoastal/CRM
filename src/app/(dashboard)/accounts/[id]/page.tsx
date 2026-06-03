import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid } from "@/components/slds/section";
import { ActivityChatterRail, type ChatterPost } from "@/components/slds/activity-chatter-rail";
import type { ActivityItem } from "@/components/slds/activity-rail";
import { RelatedList } from "@/components/slds/related-list";
import { AccountTabs } from "@/components/accounts/account-tabs";
import { AccountHeaderButtons } from "@/components/accounts/account-header-buttons";
import { BankDetailsCard } from "@/components/accounts/bank-details-card";
import { HealthCheckCard } from "@/components/accounts/health-check-card";
import { EscrowBalanceCard } from "@/components/accounts/escrow-balance-card";
import { DocumentsUpload } from "@/components/leads/documents-upload";
import { OppDebtInformation } from "@/components/opportunities/opp-debt-information";
import { PaymentCalculatorV2 } from "@/components/shared/payment-calculator-v2";
import { ACCOUNT_STAGES } from "@/lib/sf-canonical";
import { genericTone } from "@/lib/slds/status-tones";

const PATH = ACCOUNT_STAGES.map((s) => ({ label: s }));

function accountPathIndex(stage: string): number {
  const i = (ACCOUNT_STAGES as readonly string[]).indexOf(stage);
  return i >= 0 ? i : 0;
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      contacts: { include: { contact: true }, orderBy: { createdAt: "asc" } },
      opportunities: {
        include: {
          debts: true,
          _count: { select: { debts: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      parentAccount: { select: { id: true, name: true } },
      programPlans: { orderBy: { startDate: "desc" } },
      documents: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { createdAt: "desc" }, take: 50 },
      events: { orderBy: { startAt: "desc" }, take: 30 },
      emails: { orderBy: { createdAt: "desc" }, take: 30 },
      sms: { orderBy: { createdAt: "desc" }, take: 30 },
      cases: { orderBy: { createdAt: "desc" }, take: 20 },
      history: { include: { changedBy: { select: { name: true } } }, orderBy: { changedAt: "desc" }, take: 100 },
    },
  });
  if (!account) notFound();

  const activity: ActivityItem[] = [
    ...account.tasks.map((t) => ({
      id: t.id,
      type: (t.type === "CALL" ? "CALL" : "TASK") as ActivityItem["type"],
      subject: t.subject,
      meta: t.outcome ?? t.disposition ?? null,
      date: t.dueDate ?? t.completedAt ?? t.createdAt,
      done: t.status === "COMPLETED",
    })),
    ...account.events.map((e) => ({
      id: e.id,
      type: "EVENT" as const,
      subject: e.subject,
      meta: e.location ?? null,
      date: e.startAt,
      done: e.status === "COMPLETED",
    })),
    ...account.emails.map((m) => ({
      id: m.id,
      type: "EMAIL" as const,
      subject: m.subject,
      meta: `${m.direction === "OUTBOUND" ? "To" : "From"} ${m.toAddresses}`,
      date: m.sentAt ?? m.createdAt,
      done: m.status === "DELIVERED",
    })),
    ...account.sms.map((m) => ({
      id: m.id,
      type: "SMS" as const,
      subject: m.body.slice(0, 80),
      meta: `${m.direction === "OUTBOUND" ? "→" : "←"} ${m.toNumber}`,
      date: m.sentAt ?? m.createdAt,
      done: m.status === "DELIVERED",
    })),
  ];

  const chatter: ChatterPost[] = account.emails.map((m) => ({
    id: m.id,
    authorName: m.direction === "OUTBOUND" ? "You" : m.fromAddress,
    body: `${m.subject}\n\n${m.bodyText ?? m.bodyHtml?.replace(/<[^>]+>/g, "") ?? ""}`,
    createdAt: m.sentAt ?? m.createdAt,
  }));

  const allDebts = account.opportunities.flatMap((o) => o.debts);
  const totalDebt = allDebts.reduce((s, d) => s + d.originalBalance, 0) || account.currentTotalDebt || 0;
  const headerTitle = `$${totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const statusTone = (status: string): "success" | "warning" | "danger" | "neutral" => {
    if (!status) return "neutral";
    const s = status.toLowerCase();
    if (s.includes("active")) return "success";
    if (s.includes("pending")) return "warning";
    if (s.includes("nsf") || s.includes("cancel") || s.includes("suspend")) return "danger";
    return "neutral";
  };

  const detailsPanel = (
    <>
      <Section title="Account Information">
        <FieldGrid
          fields={[
            ["Account Name", account.name],
            ["Parent Account", account.parentAccount?.name && (
              <Link href={`/accounts/${account.parentAccount.id}`} style={{ color: "#1589ee" }}>{account.parentAccount.name}</Link>
            )],
            ["Industry", account.industry],
            ["Annual Revenue", account.annualRevenue ? `$${account.annualRevenue.toLocaleString()}` : null],
            ["Account ID", account.id.slice(-8).toUpperCase()],
            ["External SAS ID", account.externalSasId],
            ["EIN", account.ein],
            ["Phone", account.phone],
            ["Email", account.email],
            ["Owner", account.owner?.name],
            ["Business Start Date", account.businessStartDate?.toLocaleDateString()],
            ["UCC Filing Date", account.uccFilingDate?.toLocaleDateString()],
            ["Program Start Date", account.programStartDate?.toLocaleDateString()],
            ["Program End Date", account.programEndDate?.toLocaleDateString()],
            ["Bank Account Sync Status", account.bankAccountSyncStatus],
            ["Cancellation Date", account.cancellationDate?.toLocaleDateString()],
            ["Cancellation Reason", account.cancellationReason],
            ["Legal Status", account.legalStatus],
            ["Submitted by Legal", account.submittedByLegal],
            ["Reschedule Status", account.rescheduleStatus],
            ["Conversion Reason", account.conversionReason],
            ["Loan Provider", account.loanProvider],
            ["Collection Agency", account.collectionAgency],
          ]}
        />
      </Section>

      <Section title="Billing Address" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Street", account.billingStreet],
            ["City", account.billingCity],
            ["State", account.billingState],
            ["Zip", account.billingZip],
            ["Country", account.billingCountry],
          ]}
        />
      </Section>

      <Section title="File Status">
        <FieldGrid
          fields={[
            ["Client Status", <StatusPill key="cs" label={account.clientStatus} tone={statusTone(account.clientStatus)} />],
            ["Payment Status", <StatusPill key="ps" label={account.paymentStatus} tone={statusTone(account.paymentStatus)} />],
            ["Qualified Status", account.qualifiedStatus],
            ["High UCC Risk", account.highUccRisk ? "Yes" : "No"],
            ["Graduated Status", account.graduatedStatus],
            ["Bank Account Status", <StatusPill key="bas" label={account.bankAccountStatus} tone={statusTone(account.bankAccountStatus)} />],
          ]}
        />
      </Section>

      <Section title="Financial Summary Information" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Operating Expenses", account.operatingExpenses != null ? `$${account.operatingExpenses.toLocaleString()}` : null],
            ["Gross Profit", account.grossProfit != null ? `$${account.grossProfit.toLocaleString()}` : null],
            ["Net Profit", account.netProfit != null ? `$${account.netProfit.toLocaleString()}` : null],
            ["Debt Payments", account.debtPayments != null ? `$${account.debtPayments.toLocaleString()}` : null],
            ["EBITDA", account.ebitda != null ? `$${account.ebitda.toLocaleString()}` : null],
            ["Buyout Program Weekly Payment", account.buyoutProgramWeeklyPayment != null ? `$${account.buyoutProgramWeeklyPayment.toLocaleString()}` : null],
            ["Buyout Program Monthly Payment", account.buyoutProgramMonthlyPayment != null ? `$${account.buyoutProgramMonthlyPayment.toLocaleString()}` : null],
            ["Created", account.createdAt.toLocaleString()],
            ["Last Modified", account.updatedAt.toLocaleString()],
          ]}
        />
        {account.financialDescription && (
          <div style={{ marginTop: 12, fontSize: 13, whiteSpace: "pre-wrap" }}>{account.financialDescription}</div>
        )}
      </Section>
    </>
  );

  const activeOpp = account.opportunities[0];
  const calcPanel = activeOpp ? (
    <Section title="Reschedule Program">
      <PaymentCalculatorV2
        saveEndpoint={`/api/opportunities/${activeOpp.id}/calculator`}
        initial={{
          totalDebt: activeOpp.totalDebt ?? totalDebt,
          paymentTerm: 50,
          frequency: "WEEKLY",
          firstPaymentDate: account.programStartDate
            ? account.programStartDate.toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        }}
      />
    </Section>
  ) : (
    <Section title="Reschedule Program">
      <div style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>
        No active opportunity. Create one first to use the payment calculator.
      </div>
    </Section>
  );

  const activitiesPanel = (
    <Section title={`Activities (${activity.length})`}>
      {activity.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>No activity recorded.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
              <th style={th}>Date</th>
              <th style={th}>Type</th>
              <th style={th}>Subject</th>
              <th style={th}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {[...activity].sort((a, b) => b.date.getTime() - a.date.getTime()).map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={td}>{a.date.toLocaleString()}</td>
                <td style={td}>{a.type}</td>
                <td style={td}>{a.subject}</td>
                <td style={td}>{a.meta ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );

  const documentsPanel = (
    <Section title={`Files (${account.documents.length})`}>
      <DocumentsUpload
        endpoint={`/api/accounts/${account.id}/documents`}
        items={account.documents.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          fileSize: d.fileSize,
          createdAt: d.createdAt.toISOString(),
          uploadedBy: d.uploadedBy ? { name: d.uploadedBy.name } : null,
        }))}
      />
    </Section>
  );

  const relatedPanel = (
    <>
      {allDebts.length > 0 && (
        <RelatedList
          entity="Opportunity"
          title="Debt Details"
          items={allDebts}
          renderItem={(d) => (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
              <span>{d.creditorName}</span>
              <span>${d.originalBalance.toLocaleString()}</span>
              <span>${d.paymentAmount?.toLocaleString() ?? "—"}</span>
              <StatusPill label={d.status} tone={genericTone(d.status)} />
            </div>
          )}
          emptyHint="No debts."
        />
      )}
      <RelatedList
        entity="Opportunity"
        title="Opportunities"
        items={account.opportunities}
        renderItem={(o) => (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
            <Link href={`/opportunities/${o.id}`} style={{ color: "#1589ee" }}>{o.name ?? o.recordType}</Link>
            <span>{o.stage}</span>
            <span>v{o.version}</span>
            <span>${o.totalDebt?.toLocaleString() ?? "—"}</span>
          </div>
        )}
        emptyHint="No opportunities."
      />
      <RelatedList
        entity="Case"
        title="Cases"
        items={account.cases}
        renderItem={(c) => (
          <div>
            <Link href={`/cases/${c.id}`} style={{ color: "#1589ee" }}>{c.subject}</Link>
            <span style={{ color: "#706e6b", marginLeft: 8 }}>· {c.status}</span>
          </div>
        )}
        emptyHint="No cases."
      />
      <RelatedList
        entity="Contact"
        title="Contacts"
        items={account.contacts}
        renderItem={(rel) => (
          <div>
            <Link href={`/contacts/${rel.contact.id}`} style={{ color: "#1589ee" }}>{rel.contact.fullName}</Link>
            <span style={{ color: "#706e6b", marginLeft: 8 }}>· {rel.role}</span>
          </div>
        )}
        emptyHint="No contacts."
      />
      <RelatedList
        entity="Account"
        title="Account History"
        items={account.history}
        renderItem={(h) => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12 }}>
            <div>{new Date(h.changedAt).toLocaleString()}</div>
            <div>{h.field}</div>
            <div>{h.changedBy?.name ?? "System"}</div>
            <div style={{ color: "#706e6b" }}>{h.oldValue ?? "—"}</div>
            <div>{h.newValue ?? "—"}</div>
          </div>
        )}
        emptyHint="No history."
      />
    </>
  );

  const paymentSummariesPanel = (
    <Section title="Payment Summaries">
      <div style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>
        Aggregated payment view — coming next.
      </div>
    </Section>
  );

  const settlementsPanel = (
    <Section title="Settlements">
      {allDebts.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>No debt records yet.</div>
      ) : (
        <OppDebtInformation
          opportunityId={account.opportunities[0]?.id ?? ""}
          items={allDebts.map((d) => ({
            id: d.id,
            creditorName: d.creditorName,
            debtType: d.debtType,
            paymentFrequency: d.paymentFrequency,
            paymentAmount: d.paymentAmount,
            originalBalance: d.originalBalance,
            currentBalance: d.currentBalance,
            enrolledBalance: d.enrolledBalance,
            status: d.status,
          }))}
        />
      )}
    </Section>
  );

  const opportunitiesPanel = (
    <Section title={`Opportunities (${account.opportunities.length})`}>
      {account.opportunities.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#706e6b" }}>No opportunities yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #d8dde6" }}>
              <th style={th}>Opportunity Name</th>
              <th style={th}>Version</th>
              <th style={th}>Stage</th>
              <th style={th}>Current Total Debt</th>
            </tr>
          </thead>
          <tbody>
            {account.opportunities.map((o) => (
              <tr key={o.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={td}>
                  <Link href={`/opportunities/${o.id}`} style={{ color: "#1589ee" }}>{o.name ?? o.recordType.replace(/_/g, " ")}</Link>
                </td>
                <td style={td}>v{o.version}</td>
                <td style={td}>{o.stage}</td>
                <td style={td}>${o.totalDebt?.toLocaleString() ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );

  const marketingPanel = (
    <Section title="Marketing Attribution">
      <FieldGrid fields={[["Account Source", account.recordType.replace(/_/g, " ")]]} />
    </Section>
  );

  return (
    <RecordPage
      entity="Account"
      entityLabel="Account"
      recordTitle={headerTitle}
      recordSubtitle={
        <>
          {account.name} · <StatusPill label={account.stage} tone={statusTone(account.stage)} />
        </>
      }
      highlights={[
        { label: "Client Status", value: <StatusPill label={account.clientStatus} tone={statusTone(account.clientStatus)} /> },
        { label: "Processor Status", value: account.processorStatus ?? "Not Synced" },
        { label: "Payment Status", value: <StatusPill label={account.paymentStatus} tone={statusTone(account.paymentStatus)} /> },
        { label: "Bank Account Status", value: <StatusPill label={account.bankAccountStatus} tone={statusTone(account.bankAccountStatus)} /> },
      ]}
      actions={<AccountHeaderButtons accountId={account.id} currentStage={account.stage} />}
      pathStages={PATH}
      pathCurrentIndex={accountPathIndex(account.stage)}
      pathActionLabel="Mark Stage as Complete"
      details={
        <AccountTabs
          panels={{
            Details: detailsPanel,
            "Payment Calculator": calcPanel,
            Activities: activitiesPanel,
            Documents: documentsPanel,
            "Related Records": relatedPanel,
            "Payment Summaries": paymentSummariesPanel,
            Settlements: settlementsPanel,
            Opportunities: opportunitiesPanel,
            Marketing: marketingPanel,
          }}
        />
      }
      rail={
        <>
          <HealthCheckCard
            welcomeCallCompleted={account.welcomeCallCompleted}
            firstPaymentReceived={account.firstPaymentReceived}
          />
          <EscrowBalanceCard
            balance={account.escrowBalance}
            pulledAt={account.escrowPulledAt}
            feePaidInFull={account.feePaidInFull}
          />
          <BankDetailsCard
            accountId={account.id}
            initial={{
              bankName: account.bankName,
              bankRoutingNumber: account.bankRoutingNumber,
              bankAccountNumber: account.bankAccountNumber,
              bankAccountType: account.bankAccountType,
            }}
          />
          <RelatedList
            entity="Opportunity"
            title="Opportunities"
            items={account.opportunities}
            renderItem={(o) => (
              <div>
                <Link href={`/opportunities/${o.id}`} style={{ color: "#1589ee", fontWeight: 600 }}>
                  {o.name ?? o.recordType.replace(/_/g, " ")}
                </Link>
                <div style={{ fontSize: 11, color: "#706e6b" }}>v{o.version} · {o.stage}</div>
              </div>
            )}
            emptyHint="No opportunities."
          />
          <RelatedList
            entity="Contact"
            title="Contacts"
            items={account.contacts}
            renderItem={(rel) => (
              <div>
                <Link href={`/contacts/${rel.contact.id}`} style={{ color: "#1589ee", fontWeight: 600 }}>
                  {rel.contact.fullName}
                </Link>
                {rel.contact.email && (
                  <div style={{ fontSize: 11, color: "#706e6b" }}>{rel.contact.email}</div>
                )}
                {rel.contact.phone && (
                  <div style={{ fontSize: 11, color: "#706e6b" }}>{rel.contact.phone}</div>
                )}
              </div>
            )}
            emptyHint="No contacts."
          />
          <ActivityChatterRail activities={activity} chatter={chatter} />
        </>
      }
    />
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 700,
  fontSize: 12,
  color: "#3e3e3c",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#080707",
  fontSize: 13,
};
