import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { Section, FieldGrid, E } from "@/components/slds/section";
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
  const acctSfDateTime = (k: string): string | null => {
    const v = acctSf(k);
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
  };
  const acctSfBool = (k: string): string | null => {
    const v = acctSfData[k];
    if (v == null || v === "") return null;
    if (typeof v === "boolean") return v ? "Yes" : "No";
    const s = String(v).toLowerCase();
    if (s === "true") return "Yes";
    if (s === "false") return "No";
    return String(v);
  };

  const phoneVal = account.phone ?? acctSf("Phone");
  const emailVal = account.email ?? acctSf("Email__c");
  const ownerName = account.owner?.name ?? acctSf("Owner_Full_Name__c") ?? acctSf("OwnerName");
  const parentAcctNode = account.parentAccount?.name
    ? <Link href={`/accounts/${account.parentAccount.id}`} style={{ color: "#1589ee" }}>{account.parentAccount.name}</Link>
    : acctSf("Parent_Account_Name__c") ?? acctSf("ParentName") ?? acctSf("Parent_Account__c");

  const detailsPanel = (
    <>
      {/* SF Account Information — field pairs match Lightning layout exactly.
          Tuples render row-by-row across two columns: left first, then right. */}
      <Section title="Account Information">
        <FieldGrid
          entityType="account"
          entityId={account.id}
          fields={[
            // Row 1: Account Name | Rating
            E("Account Name", account.name ?? acctSf("Name"), "name", "text", { rawValue: account.name }),
            ["Rating", acctSf("Rating")],
            // Row 2: Account Owner | Owner Full Name
            ["Account Owner", ownerName],
            ["Owner Full Name", acctSf("Owner_Full_Name__c") ?? ownerName],
            // Row 3: Parent Account | Phone
            ["Parent Account", parentAcctNode],
            [
              "Phone",
              phoneVal ? (
                <span key="ph" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {phoneVal}
                  <CallButton phone={phoneVal} accountId={account.id} />
                </span>
              ) : null,
              { fieldKey: "phone", type: "phone", rawValue: account.phone ?? phoneVal },
            ],
            // Row 4: Account Number | Fax
            ["Account Number", acctSf("AccountNumber") ?? account.id.slice(-8).toUpperCase()],
            E("Account Fax", acctSf("Fax"), "Fax"),
            // Row 5: Account Site | Website
            E("Account Site", acctSf("Site"), "Site"),
            E("Website", acctSf("Website"), "website", "text", { rawValue: account.website }),
            // Row 6: Type | Ticker Symbol
            E("Type", acctSf("Type") ?? account.recordType.replace(/_/g, " "), "type", "text", { rawValue: account.type }),
            E("Ticker Symbol", acctSf("TickerSymbol"), "TickerSymbol"),
            // Row 7: Industry | Ownership
            E("Industry", account.industry ?? acctSf("Industry"), "industry", "text", { rawValue: account.industry }),
            E("Ownership", acctSf("Ownership"), "Ownership"),
            // Row 8: Annual Revenue | Employees
            E("Annual Revenue", account.annualRevenue ? `$${account.annualRevenue.toLocaleString()}` : acctSfDollar("AnnualRevenue"), "annualRevenue", "number", { rawValue: account.annualRevenue ?? null }),
            E("Employees", acctSf("NumberOfEmployees"), "numberOfEmployees", "number", { rawValue: account.numberOfEmployees ?? null }),
            // Row 9: SSN | SIC Code
            E("SSN", acctSf("SSN__c"), "SSN__c"),
            E("SIC Code", acctSf("Sic") ?? acctSf("SicCode"), "Sic"),
            // Row 10: EIN Number / Tax Id | Total Debt
            E("EIN Number / Tax Id", account.ein ?? acctSf("EIN_Number_Tax_Id__c"), "ein", "text", { rawValue: account.ein }),
            ["Total Debt", acctSfDollar("Total_Debt__c")],
            // Row 11: Lead Id | Current Balance
            ["Lead Id", acctSf("Lead_Id__c") ?? acctSf("LeadId")],
            ["Current Balance", acctSfDollar("Current_Total_Debt_Amount__c") ?? acctSfDollar("Current_Balance__c")],
            // Row 12: Program Start Date | Account Record Type
            ["Program Start Date", account.programStartDate?.toLocaleDateString() ?? acctSfDate("Program_Start_Date__c")],
            ["Account Record Type", account.recordType.replace(/_/g, " ")],
            // Row 13: Program End Date | Creation Date
            ["Program End Date", account.programEndDate?.toLocaleDateString() ?? acctSfDate("Program_End_Date__c")],
            ["Creation Date", account.createdAt.toLocaleDateString()],
            // Row 14: External SAS Id | Primary Contact
            ["External SAS Id", account.externalSasId ?? acctSf("External_SAS_Id__c")],
            ["Primary Contact", account.primaryContact?.fullName ? (
              <Link key="pc" href={`/contacts/${account.primaryContact.id}`} style={{ color: "#1589ee" }}>{account.primaryContact.fullName}</Link>
            ) : acctSf("Primary_Contact__c")],
            // Row 15: External RAM Id | Closer
            ["External RAM Id", acctSf("External_RAM_Id__c") ?? acctSf("RAM_Id__c")],
            ["Closer", account.opportunities[0]?.closer ?? acctSf("Closer__c")],
            // Row 16: External Citadel Id | Created Date Time
            ["External Citadel Id", acctSf("External_Citadel_Id__c")],
            ["Created Date Time", account.createdAt.toLocaleString()],
            // Row 17: Sync Status | First Draft Date
            ["Sync Status", account.bankAccountSyncStatus ?? acctSf("Sync_Status__c") ?? acctSf("Bank_Account_Sync_Status__c")],
            ["First Draft Date", acctSfDate("First_Draft_Date__c")],
            // Row 18: Bank Account Sync | (blank right)
            ["Bank Account Sync", account.bankAccountSyncStatus ?? acctSf("Bank_Account_Sync_Status__c")],
            ["", null],
            // Email + supporting fields (not in SF screenshot but useful)
            ["Email", emailVal ? (
              <span key="em" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {emailVal}
                <ComposeEmailButton defaultTo={emailVal} accountId={account.id} label="Email" />
              </span>
            ) : null],
            ["Owner Email", account.owner?.email ?? acctSf("Owner_Username__c")],
            ["Fronter", account.opportunities[0]?.fronter ?? acctSf("Fronter__c")],
            ["Business Start Date", account.businessStartDate?.toLocaleDateString() ?? acctSfDate("Business_Start_Date__c")],
            ["UCC Filing Date", account.uccFilingDate?.toLocaleDateString() ?? acctSfDate("UCC_Filing_Date__c")],
            ["Cancellation Date", account.cancellationDate?.toLocaleDateString() ?? acctSfDate("Cancellation_Date__c")],
            ["Cancellation Reason", account.cancellationReason ?? acctSf("Cancellation_Reason__c")],
            ["Legal Status", account.legalStatus ?? acctSf("Legal_Status__c")],
            ["Legal Network", acctSf("Legal_Network__c")],
            ["Submitted by Legal", account.submittedByLegal ?? acctSf("Submitted_By_Legal__c")],
            ["Reschedule Status", account.rescheduleStatus ?? acctSf("Reschedule_Status__c")],
            ["Reschedule Program Pending", acctSfBool("Reschedule_Program_Pending__c")],
            ["Conversion Reason", account.conversionReason ?? acctSf("Conversion_Reason__c")],
            ["Loan Provider", account.loanProvider ?? acctSf("Loan_Provider__c")],
            ["Collection Agency", account.collectionAgency ?? acctSf("Collection_Agency__c")],
            // SF identity + key metadata
            ["Account ID", acctSf("Id") ?? account.sfId],
            ["Client Number", acctSf("Client_Number__c")],
            ["Primary Contact Name", acctSf("Primary_Contact_Name__c")],
            ["Closer FIrst Name", acctSf("Closer_FIrst_Name__c") ?? acctSf("Closer_FIrst_Name__pc")],
            ["Sub Disposition", acctSf("Sub_Disposition__c")],
            ["Processor Status", acctSf("Status__c") ?? account.processorStatus],
            ["Important", acctSfBool("IsPriorityRecord")],
            ["Upsell Opportunity", acctSf("UpsellOpportunity__c")],
            ["Lead Created Date", acctSfDateTime("Lead_Created_Date__c")],
            ["Synced DateTime", acctSfDateTime("Synced_DateTime__c")],
            ["First Contract Signed Date", acctSfDateTime("First_Contract_Signed_Date__c")],
            ["First Payment Completed Date", acctSfDate("First_Payment_Completed_Date__c") ?? acctSfDate("First_Payment_Date__c")],
            ["Contract Sync Status", acctSf("Contract_Sync_Status__c")],
            ["Verified Phone Number", acctSfBool("Verified_Phone_Number__pc")],
            ["SMS Opt Out", acctSfBool("smagicinteract__SMSOptOut__pc")],
            ["Work Phone", acctSf("Work_Phone__c")],
            ["Other Industry", acctSf("Other_Industry__c")],
            ["Debt Negotiator", acctSf("Debt_Negotiator__c")],
            ["Graduation Status", acctSf("Graduation_Status__c")],
            ["Negotiation Status", acctSf("NegotiationStatus__c")],
            ["Last Synced By", acctSf("Last_Synced_By__c")],
            ["Last Synced Date Time", acctSfDateTime("Last_Synced_Date_Time__c")],
          ]}
        />
      </Section>

      <Section title="Billing Address" defaultOpen={false}>
        <FieldGrid
          entityType="account"
          entityId={account.id}
          fields={[
            E("Billing Street", account.billingStreet ?? acctSf("BillingStreet"), "billingStreet", "text", { rawValue: account.billingStreet }),
            E("Billing City", account.billingCity ?? acctSf("BillingCity"), "billingCity", "text", { rawValue: account.billingCity }),
            E("Billing State/Province", account.billingState ?? acctSf("BillingState"), "billingState", "text", { rawValue: account.billingState }),
            E("Billing Zip/Postal Code", account.billingZip ?? acctSf("BillingPostalCode"), "billingZip", "text", { rawValue: account.billingZip }),
            E("Billing Country", account.billingCountry ?? acctSf("BillingCountry"), "billingCountry", "text", { rawValue: account.billingCountry }),
            E("Billing County", acctSf("BillingCounty__c"), "BillingCounty__c"),
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
            ["Escrow Balance Pulled Date Time", acctSfDateTime("Escrow_Balance_Pulled_Date_Time__c")],
            ["Total Fees Collected", acctSfDollar("Total_Fees_Collected__c")],
            ["Fee Paid In Full", acctSfBool("Fee_Paid_In_Full__c")],
            ["Number of Drafts", acctSf("Number_of_Drafts__c")],
            ["Completed Draft Count", acctSf("Completed_Draft_Count__c")],
            ["Missed Drafts", acctSf("Missed_Drafts__c")],
            ["First Draft Date", acctSfDate("First_Draft_Date__c")],
            ["Last Draft Date", acctSfDate("Last_Draft_Date__c")],
            ["Welcome Call Completed", acctSf("Welcome_Call_Completed__c")],
            ["Bank Verification Status", acctSf("Bank_Verification_Status__c")],
            ["Routing Number", acctSf("Routing_Number__c")],
            ["Account Number (masked)", acctSf("Account_Number_Masked__c")],
            ["Processor", acctSf("Processor__c")],
            ["RAM/SAS Status", acctSf("RAM_SAS_Status__c")],
            ["Program Completion Stage", acctSfBool("Program_Completion_Stage__c")],
            ["Qualified Financial", acctSfBool("Qualified_Financial__c")],
            ["Actual Program Term", acctSf("Actual_Program_Term__c")],
            ["Actual Weekly Payment", acctSfDollar("Actual_Weekly_Payment__c")],
            ["Buyout Program Weeks", acctSf("Buyout_Program_Weeks__c")],
          ]}
        />
      </Section>

      <Section title="Bank Information (from SF)" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Bank Name", acctSf("Bank_Name__c")],
            ["Bank Routing Number", acctSf("Bank_Routing_Number__c")],
            ["Bank Account Number", acctSf("Bank_Account_Number__c")],
            ["Bank Account Type", acctSf("Bank_Account_Type__c")],
            ["Bank Account Sync Status", acctSf("Bank_Account_Sync_Status__c")],
            ["IsChecking", acctSf("IsChecking__c")],
          ]}
        />
      </Section>

      <Section title="Activity Tracking" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Last Called Time", acctSfDateTime("Last_Call__c")],
            ["Last Contacted DateTime", acctSfDateTime("Last_Contacted_DateTime__c")],
            ["Last Emailed Time", acctSfDateTime("Last_Email__c")],
            ["Last SMS Time", acctSfDateTime("Last_SMS__c")],
            ["Week Days Between Last Activity Date", acctSf("Week_Days_Between_Last_Activity_Date__c")],
          ]}
        />
      </Section>

      <Section title="File Status">
        <FieldGrid
          fields={[
            ["Client Status", <StatusPill key="cs" label={account.clientStatus} tone={statusTone(account.clientStatus)} />],
            ["Payment Status", <StatusPill key="ps" label={account.paymentStatus} tone={statusTone(account.paymentStatus)} />],
            ["Qualified Status", account.qualifiedStatus],
            ["HIGH UCC RISK", acctSfBool("HIGH_UCC_RISK__c") ?? (account.highUccRisk ? "Yes" : "No")],
            ["High UCC RISK", acctSfBool("High_UCC_RISK__pc")],
            ["Graduated Status", account.graduatedStatus],
            ["Bank Account Status", <StatusPill key="bas" label={account.bankAccountStatus} tone={statusTone(account.bankAccountStatus)} />],
          ]}
        />
      </Section>

      <Section title="Financial Summary Information" defaultOpen={false}>
        <FieldGrid
          fields={[
            ["Operating Expenses", account.operatingExpenses != null ? `$${account.operatingExpenses.toLocaleString()}` : null],
            ["Operating Expense", acctSfDollar("Operating_Expense__c")],
            ["Direct Expenses", acctSfDollar("Direct_Expenses__c")],
            ["Gross Profit", account.grossProfit != null ? `$${account.grossProfit.toLocaleString()}` : null],
            ["Net Profit", account.netProfit != null ? `$${account.netProfit.toLocaleString()}` : null],
            ["Profit", acctSfDollar("Profit__c")],
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
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
            <Link href={`/opportunities/${o.id}`} style={{ color: "#1589ee" }}>{o.name ?? o.recordType.replace(/_/g, " ")}</Link>
            <span>{o.stage}</span>
            <span>${(o.totalDebt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
              <th style={th}>Version Status</th>
              <th style={th}>Total Debt Included</th>
              <th style={th}>Current Total Debt</th>
            </tr>
          </thead>
          <tbody>
            {account.opportunities.map((o) => (
              <tr key={o.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                <td style={td}>
                  <Link href={`/opportunities/${o.id}`} style={{ color: "#1589ee" }}>{o.name ?? o.recordType.replace(/_/g, " ")}</Link>
                </td>
                <td style={td}>{o.stage}</td>
                <td style={td}>${(o.totalDebt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style={td}>${(o.totalDebt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
          ["Account Engagement Hard Bounced", acctSfBool("pi__pardot_hard_bounced__pc")],
          ["Needs Score Synced", acctSfBool("pi__Needs_Score_Synced__pc")],
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
      recordSubtitle={account.name}
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
          {/* SF rail order — Health Check, Escrow Balance, Bank Details, Opportunities, Contacts */}
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
          <RelatedList
            entity="Opportunity"
            title="Opportunities"
            items={account.opportunities}
            renderItem={(o) => (
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <Link href={`/opportunities/${o.id}`} style={{ color: "#1589ee", fontWeight: 600, fontSize: 13 }}>
                  {o.name ?? o.recordType.replace(/_/g, " ")}
                </Link>
                <div style={{ color: "#3e3e3c", marginTop: 4 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0 8px" }}>
                    <span style={{ fontWeight: 700 }}>Version Status:</span>
                    <span>{o.stage}</span>
                    <span style={{ fontWeight: 700 }}>Total Debt Included:</span>
                    <span>${(o.totalDebt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span style={{ fontWeight: 700 }}>Current Total Debt:</span>
                    <span>${(o.totalDebt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
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
          <AccountTeamCard
            ownerName={account.owner?.name ?? null}
            ownerEmail={account.owner?.email ?? null}
            members={teamMembers}
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
