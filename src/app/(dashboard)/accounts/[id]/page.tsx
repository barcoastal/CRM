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
import { AccountTeamCard } from "@/components/accounts/account-team-card";
import { ContactRolesList } from "@/components/accounts/contact-roles-list";
import { DocumentsUpload } from "@/components/leads/documents-upload";
import { OppDebtInformation } from "@/components/opportunities/opp-debt-information";
import { PaymentCalculatorV2 } from "@/components/shared/payment-calculator-v2";
import { EnvelopesRelatedList } from "@/components/envelopes/envelopes-related-list";
import { CallButton } from "@/components/dialer/call-button";
import { ComposeEmailButton } from "@/components/emails/compose-email-button";
import { ACCOUNT_STAGES } from "@/lib/sf-canonical";
import { SfDataSection } from "@/components/slds/sf-data-section";
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
      primaryContact: { select: { id: true, fullName: true, email: true, phone: true, title: true } },
      contacts: { include: { contact: true }, orderBy: { createdAt: "asc" } },
      opportunities: {
        include: {
          debts: true,
          assignedTo: { select: { id: true, name: true, email: true } },
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
      envelopes: { orderBy: { createdAt: "desc" }, take: 30 },
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

  let acctSfData: Record<string, unknown> = {};
  try { acctSfData = account.sfDataJson ? JSON.parse(account.sfDataJson) as Record<string, unknown> : {}; } catch { /* empty */ }
  const acctSf = (k: string): string | null => {
    const v = acctSfData[k];
    if (v == null || v === "") return null;
    return String(v);
  };
  const acctSfDollar = (k: string): string | null => {
    const v = acctSf(k);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? `$${n.toLocaleString()}` : v;
  };
  const acctSfDate = (k: string): string | null => {
    const v = acctSf(k);
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
  };

  const detailsPanel = (
    <>
      <Section title="Account Information">
        <FieldGrid
          fields={[
            ["Account Name", account.name ?? acctSf("Name")],
            ["Parent Account", account.parentAccount?.name && (
              <Link href={`/accounts/${account.parentAccount.id}`} style={{ color: "#1589ee" }}>{account.parentAccount.name}</Link>
            )],
            ["Industry", account.industry ?? acctSf("Industry")],
            ["Annual Revenue", account.annualRevenue ? `$${account.annualRevenue.toLocaleString()}` : acctSfDollar("AnnualRevenue")],
            ["Number of Employees", acctSf("NumberOfEmployees")],
            ["Website", acctSf("Website")],
            ["Account ID", account.id.slice(-8).toUpperCase()],
            ["External SAS ID", account.externalSasId ?? acctSf("External_SAS_Id__c")],
            ["EIN", account.ein ?? acctSf("EIN_Number_Tax_Id__c")],
            ["DBA Name", acctSf("DBA_Name__c")],
            ["Phone", <span key="ph" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{account.phone ?? acctSf("Phone")}<CallButton phone={account.phone ?? acctSf("Phone") ?? ""} accountId={account.id} /></span>],
            ["Email", <span key="em" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>{account.email ?? acctSf("Email__c")}{(account.email ?? acctSf("Email__c")) && <ComposeEmailButton defaultTo={(account.email ?? acctSf("Email__c"))!} accountId={account.id} label="Email" />}</span>],
            ["Owner", account.owner?.name ?? acctSf("Owner_Full_Name__c")],
            ["Owner Email", account.owner?.email ?? acctSf("Owner_Username__c")],
            ["Primary Contact", account.primaryContact?.fullName ? (
              <Link key="pc" href={`/contacts/${account.primaryContact.id}`} style={{ color: "#1589ee" }}>{account.primaryContact.fullName}</Link>
            ) : acctSf("Primary_Contact__c")],
            ["Closer", account.opportunities[0]?.closer ?? acctSf("Closer__c")],
            ["Fronter", account.opportunities[0]?.fronter ?? acctSf("Fronter__c")],
            ["Business Start Date", account.businessStartDate?.toLocaleDateString() ?? acctSfDate("Business_Start_Date__c")],
            ["UCC Filing Date", account.uccFilingDate?.toLocaleDateString() ?? acctSfDate("UCC_Filing_Date__c")],
            ["Program Start Date", account.programStartDate?.toLocaleDateString() ?? acctSfDate("Program_Start_Date__c")],
            ["Program End Date", account.programEndDate?.toLocaleDateString() ?? acctSfDate("Program_End_Date__c")],
            ["First Payment Date", acctSfDate("First_Payment_Date__c")],
            ["Bank Account Sync Status", account.bankAccountSyncStatus ?? acctSf("Bank_Account_Sync_Status__c")],
            ["Cancellation Date", account.cancellationDate?.toLocaleDateString() ?? acctSfDate("Cancellation_Date__c")],
            ["Cancellation Reason", account.cancellationReason ?? acctSf("Cancellation_Reason__c")],
            ["Legal Status", account.legalStatus ?? acctSf("Legal_Status__c")],
            ["Submitted by Legal", account.submittedByLegal ?? acctSf("Submitted_By_Legal__c")],
            ["Reschedule Status", account.rescheduleStatus ?? acctSf("Reschedule_Status__c")],
            ["Conversion Reason", account.conversionReason ?? acctSf("Conversion_Reason__c")],
            ["Loan Provider", account.loanProvider ?? acctSf("Loan_Provider__c")],
            ["Collection Agency", account.collectionAgency ?? acctSf("Collection_Agency__c")],
          ]}
        />
      </Section>

      <Section title="Billing Address" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Street", account.billingStreet ?? acctSf("BillingStreet")],
            ["City", account.billingCity ?? acctSf("BillingCity")],
            ["State", account.billingState ?? acctSf("BillingState")],
            ["Zip", account.billingZip ?? acctSf("BillingPostalCode")],
            ["Country", account.billingCountry ?? acctSf("BillingCountry")],
          ]}
        />
      </Section>

      <Section title="Program & Financial (from SF)" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Total Debt", acctSfDollar("Total_Debt__c")],
            ["Current Total Debt", acctSfDollar("Current_Total_Debt_Amount__c")],
            ["Settled Total", acctSfDollar("Total_Settled__c")],
            ["Total Paid to Date", acctSfDollar("Total_Paid_to_Date__c")],
            ["Active Settlements", acctSf("Active_Settlements__c")],
            ["Escrow Balance", acctSfDollar("Escrow_Balance__c")],
            ["Total Fees Collected", acctSfDollar("Total_Fees_Collected__c")],
            ["Number of Drafts", acctSf("Number_of_Drafts__c")],
            ["Missed Drafts", acctSf("Missed_Drafts__c")],
            ["First Draft Date", acctSfDate("First_Draft_Date__c")],
            ["Last Draft Date", acctSfDate("Last_Draft_Date__c")],
            ["Welcome Call Completed", acctSf("Welcome_Call_Completed__c")],
            ["Bank Verification Status", acctSf("Bank_Verification_Status__c")],
            ["Routing Number", acctSf("Routing_Number__c")],
            ["Account Number (masked)", acctSf("Account_Number_Masked__c")],
            ["Processor", acctSf("Processor__c")],
            ["RAM/SAS Status", acctSf("RAM_SAS_Status__c")],
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
          termMonths: 6,
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
    <>
      <EnvelopesRelatedList
        envelopes={account.envelopes.map((e) => ({
          id: e.id,
          recordType: e.recordType,
          status: e.status,
          signerName: e.signerName,
          signerEmail: e.signerEmail,
          templateName: e.templateName,
          documentName: e.documentName,
          signingToken: e.signingToken,
          sentAt: e.sentAt?.toISOString() ?? null,
          signedAt: e.signedAt?.toISOString() ?? null,
          completedAt: e.completedAt?.toISOString() ?? null,
          createdAt: e.createdAt.toISOString(),
        }))}
        accountId={account.id}
        defaultSignerName={account.contacts[0]?.contact.fullName}
        defaultSignerEmail={account.contacts[0]?.contact.email ?? undefined}
      />
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
    </>
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
      <FieldGrid
        fields={[
          ["Account Source", account.recordType.replace(/_/g, " ")],
          ["Lead Source", acctSf("LeadSource")],
          ["Lead Source Category", acctSf("Lead_Source_Category__c")],
          ["Campaign", acctSf("Campaign__c")],
          ["UTM Source", acctSf("UTM_Source__c")],
          ["UTM Medium", acctSf("UTM_Medium__c")],
          ["UTM Campaign", acctSf("UTM_Campaign__c")],
          ["UTM Term", acctSf("UTM_Term__c")],
          ["UTM Content", acctSf("UTM_Content__c")],
          ["Account Engagement Score", acctSf("Account_Engagement_Score__c")],
        ]}
      />
    </Section>
  );

  const contactsPanel = (
    <ContactRolesList
      rows={account.contacts.map((rel) => ({
        id: rel.id,
        role: rel.role,
        isPrimary: rel.contact.id === account.primaryContactId,
        contact: {
          id: rel.contact.id,
          fullName: rel.contact.fullName,
          title: rel.contact.title,
          email: rel.contact.email,
          phone: rel.contact.phone,
        },
      }))}
    />
  );

  const teamMembers = (() => {
    const seen = new Set<string>();
    const members: { role: string; name: string | null; email?: string | null }[] = [];
    for (const opp of account.opportunities) {
      if (opp.assignedTo?.name && !seen.has(`a:${opp.assignedTo.id}`)) {
        seen.add(`a:${opp.assignedTo.id}`);
        members.push({ role: "Opp Assignee", name: opp.assignedTo.name, email: opp.assignedTo.email });
      }
      if (opp.closer && !seen.has(`c:${opp.closer}`)) {
        seen.add(`c:${opp.closer}`);
        members.push({ role: "Closer", name: opp.closer });
      }
      if (opp.fronter && !seen.has(`f:${opp.fronter}`)) {
        seen.add(`f:${opp.fronter}`);
        members.push({ role: "Fronter", name: opp.fronter });
      }
    }
    return members;
  })();

  const teamPanel = (
    <Section title="Account Team">
      <FieldGrid
        fields={[
          ["Owner", account.owner?.name],
          ["Owner Email", account.owner?.email],
          ...teamMembers.map((m) => [m.role, m.name] as [string, string | null]),
        ]}
      />
    </Section>
  );

  const sfFieldsPanel = (
    <SfDataSection sfDataJson={account.sfDataJson} sfId={account.sfId} />
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
            Contacts: contactsPanel,
            Team: teamPanel,
            Marketing: marketingPanel,
            "All SF Fields": sfFieldsPanel,
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
            accountId={account.id}
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
          <AccountTeamCard
            ownerName={account.owner?.name ?? null}
            ownerEmail={account.owner?.email ?? null}
            members={teamMembers}
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
