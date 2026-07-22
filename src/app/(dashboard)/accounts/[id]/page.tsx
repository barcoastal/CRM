import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecordPage, StatusPill } from "@/components/slds/record-page";
import { PathSidePanelServer } from "@/components/path/path-side-panel-server";
import { Section, FieldGrid } from "@/components/slds/section";
import { E } from "@/components/slds/field-helpers";
import { ActivityChatterRail, type ChatterPost } from "@/components/slds/activity-chatter-rail";
import type { ActivityItem } from "@/components/slds/activity-rail";
import { RelatedList } from "@/components/slds/related-list";
import { AccountTabs } from "@/components/accounts/account-tabs";
import { LivePaymentGrid } from "@/components/program-plans/live-payment-grid";
import { AccountHeaderButtons } from "@/components/accounts/account-header-buttons";
import { BankDetailsCard } from "@/components/accounts/bank-details-card";
import { HealthCheckCard } from "@/components/accounts/health-check-card";
import { EscrowBalanceCard } from "@/components/accounts/escrow-balance-card";
import { SasDetailsPanel } from "@/components/accounts/sas-details-panel";
import { AccountTeamCard } from "@/components/accounts/account-team-card";
import { ChecklistCard } from "@/components/accounts/checklist-card";
import { ContactRolesList } from "@/components/accounts/contact-roles-list";
import { DocumentsUpload } from "@/components/leads/documents-upload";
import { OppDebtInformation } from "@/components/opportunities/opp-debt-information";
import { RescheduleCalculator } from "@/components/shared/reschedule-calculator";
import { EnvelopesRelatedList } from "@/components/envelopes/envelopes-related-list";
import { CallButton } from "@/components/dialer/call-button";
import { ComposeEmailButton } from "@/components/emails/compose-email-button";
import { ACCOUNT_STAGES } from "@/lib/sf-canonical";
import { SfDataSection } from "@/components/slds/sf-data-section";
import { genericTone } from "@/lib/slds/status-tones";
import { LeadHistoryCard } from "@/components/leads/lead-history-card";
import { FilesCard, NotesCard } from "@/components/accounts/files-notes-cards";

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
      programPlans: {
        orderBy: { startDate: "desc" },
        include: { drafts: { orderBy: { scheduledDate: "asc" }, take: 100 } },
      },
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
  // SF header shows the account's Total Debt field, NOT the sum of all debt
  // records across every (incl. archived) opportunity - those can differ.
  const totalDebt = account.currentTotalDebt || allDebts.reduce((s, d) => s + d.originalBalance, 0) || 0;
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

  // SF HealthCheckerAccount parity: "Welcome Call completed" = a COMPLETED
  // task on the account whose subject contains "Welcome Call Completed".
  const welcomeCallTask = await prisma.task.count({
    where: {
      accountId: account.id,
      status: "COMPLETED",
      subject: { contains: "Welcome Call Completed", mode: "insensitive" },
    },
  });
  const welcomeCallDone = account.welcomeCallCompleted || welcomeCallTask > 0;

  // SF Checklist rail card: stage checklist items (Task RT Checklist_Item).
  const checklistTasks = await prisma.task.findMany({
    where: { accountId: account.id, recordType: "CHECKLIST" },
    orderBy: { createdAt: "asc" },
    take: 30,
    include: { owner: { select: { name: true } } },
  });

  const phoneVal = account.phone ?? acctSf("Phone");
  const emailVal = account.email ?? acctSf("Email__c");
  const ownerName = account.owner?.name ?? acctSf("Owner_Full_Name__c") ?? acctSf("OwnerName");
  // Active users for the Account Owner inline-edit select (SF: change owner).
  const ownerOptions = (
    await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  ).map((u) => ({ label: u.name, value: u.id }));
  const parentAcctNode = account.parentAccount?.name
    ? <Link href={`/accounts/${account.parentAccount.id}`} style={{ color: "#0176d3" }}>{account.parentAccount.name}</Link>
    : acctSf("Parent_Account_Name__c") ?? acctSf("ParentName") ?? acctSf("Parent_Account__c");

  // SF Account Details — field pairs verified against docs/sf-screenshots/sf-account-detail.png
  // (Dakota Enterprises LLC). Even index = left col, odd index = right col.
  const ratingDisplay = acctSf("Rating");
  const ownerFullNameDisplay = acctSf("Owner_Full_Name__c") ?? ownerName;
  const processorStatusDisplay = account.processorStatus ?? acctSf("Status__c") ?? acctSf("Processor_Status__c");
  const faxDisplay = acctSf("Fax");
  const websiteDisplay = account.website ?? acctSf("Website");
  const tickerSymbolDisplay = acctSf("TickerSymbol");
  const ownershipDisplay = acctSf("Ownership");
  const employeesDisplay = account.numberOfEmployees ?? acctSf("NumberOfEmployees");
  const sicCodeDisplay = acctSf("Sic") ?? acctSf("SicCode");
  const totalDebtSfDisplay = acctSfDollar("Total_Debt__c") ?? `$${totalDebt.toLocaleString()}`;
  const currentBalanceDisplay = acctSfDollar("Current_Total_Debt_Amount__c") ?? acctSfDollar("Current_Balance__c");
  const creditorTypeDisplay = acctSf("Creditor_Type__c");
  const accountRecordTypeDisplay = acctSf("Account_Record_Type__c") ?? account.recordType.replace(/_/g, " ");
  const primaryContactNode = account.primaryContact?.fullName ? (
    <Link key="pc" href={`/contacts/${account.primaryContact.id}`} style={{ color: "#0176d3" }}>{account.primaryContact.fullName}</Link>
  ) : (acctSf("Primary_Contact_Name__c") ?? acctSf("Primary_Contact__c"));
  const syncedDateTimeDisplay = acctSfDateTime("Synced_DateTime__c");
  const closerDisplay = account.opportunities[0]?.closer ?? acctSf("Closer__c");
  const firstDraftDateDisplay = acctSfDate("First_Draft_Date__c");
  const lastContactedDateTimeDisplay = acctSfDateTime("Last_Contacted_DateTime__c");
  const firstPaymentCompletedDateDisplay = acctSfDate("First_Payment_Completed_Date__c") ?? acctSfDate("First_Payment_Date__c");
  const lastCalledTimeDisplay = acctSfDateTime("Last_Call__c");
  const lastEmailedTimeDisplay = acctSfDateTime("Last_Email__c");
  const lastSMSTimeDisplay = acctSfDateTime("Last_SMS__c");
  const lastSyncedByDisplay = acctSf("Last_Synced_By__c");
  const lastSyncedDateTimeDisplay = acctSfDateTime("Last_Synced_Date_Time__c");
  const weekDaysBetweenLastActivityDisplay = acctSf("Week_Days_Between_Last_Activity_Date__c");
  const programCompletionStageDisplay = acctSfBool("Program_Completion_Stage__c");
  const collectionAgencyDisplay = account.collectionAgency ?? acctSf("Collection_Agency__c");
  const legalNetworkDisplay = acctSf("Legal_Network__c");
  const legalNetworkSyncStatusDisplay = acctSf("Legal_Network_Sync_Status__c");
  const billingAddressNode = (
    <div key="ba" style={{ color: "#0176d3", whiteSpace: "pre-line" }}>
      {[
        account.billingStreet ?? acctSf("BillingStreet"),
        [account.billingCity ?? acctSf("BillingCity"), account.billingState ?? acctSf("BillingState"), account.billingZip ?? acctSf("BillingPostalCode")].filter(Boolean).join(", "),
        account.billingCountry ?? acctSf("BillingCountry"),
      ].filter(Boolean).join("\n") || ""}
    </div>
  );
  const shippingAddressNode = (
    <div key="sa" style={{ color: "#0176d3", whiteSpace: "pre-line" }}>
      {[
        acctSf("ShippingStreet"),
        [acctSf("ShippingCity"), acctSf("ShippingState"), acctSf("ShippingPostalCode")].filter(Boolean).join(", "),
        acctSf("ShippingCountry"),
      ].filter(Boolean).join("\n") || ""}
    </div>
  );
  const billingCountyDisplay = acctSf("BillingCounty__c");
  const createdByDisplay = `${acctSf("CreatedBy_Full_Name__c") ?? ""}${acctSf("CreatedBy_Full_Name__c") ? `, ${account.createdAt.toLocaleString()}` : account.createdAt.toLocaleString()}`;
  const lastModifiedByDisplay = `${acctSf("LastModifiedBy_Full_Name__c") ?? ""}${acctSf("LastModifiedBy_Full_Name__c") ? `, ${account.updatedAt.toLocaleString()}` : account.updatedAt.toLocaleString()}`;

  const detailsPanel = (
    <>
      {/* SF Dakota Enterprises Account Details — pair-by-pair parity with SF Lightning.
          Rows alternate left/right top-to-bottom; even index = left col,
          odd index = right col. E(...) rows are inline-editable.
          SF marks Account Information + Address Information detailHeading=false,
          so Lightning renders these fields with NO section header. Bare grid. */}
        <FieldGrid
          entityType="account"
          entityId={account.id}
          fields={[
            // Row 1: Account Name | Rating
            E("Account Name", account.name ?? acctSf("Name"), "name", "text", { rawValue: account.name }),
            E("Rating", ratingDisplay, "Rating"),
            // Row 2: Account Owner | Owner Full Name
            E(
              "Account Owner",
              account.ownerId
                ? <Link key="aown" href={`/settings/users/${account.ownerId}`} style={{ color: "#0176d3" }}>{ownerName}</Link>
                : ownerName,
              "ownerId",
              "select",
              { rawValue: account.ownerId ?? null, options: ownerOptions },
            ),
            // SF renders the owner as a user link (admins land on the user's
            // record page with owned records + logs).
            ["Owner Full Name", account.ownerId
              ? <Link key="own" href={`/settings/users/${account.ownerId}`} style={{ color: "#0176d3" }}>{ownerFullNameDisplay}</Link>
              : ownerFullNameDisplay],
            // Row 3: Parent Account | Processor Status
            ["Parent Account", parentAcctNode],
            ["Processor Status", processorStatusDisplay],
            // Row 4: Account Number | Phone
            ["Account Number", acctSf("AccountNumber") ?? account.id.slice(-8).toUpperCase()],
            [
              "Phone",
              // SF renders the number as a plain blue link - clicking dials.
              phoneVal ? <CallButton key="ph" phone={phoneVal} accountId={account.id} variant="link" label={phoneVal} /> : null,
              { fieldKey: "phone", type: "phone", rawValue: account.phone ?? phoneVal },
            ],
            // Row 5: Account Site | Fax
            E("Account Site", acctSf("Site"), "Site"),
            E("Fax", faxDisplay, "Fax"),
            // Row 6: Type | Website
            E("Type", acctSf("Type") ?? account.recordType.replace(/_/g, " "), "type", "text", { rawValue: account.type }),
            E("Website", websiteDisplay, "website", "text", { rawValue: account.website }),
            // Row 7: Industry | Ticker Symbol
            E("Industry", account.industry ?? acctSf("Industry"), "industry", "text", { rawValue: account.industry }),
            E("Ticker Symbol", tickerSymbolDisplay, "TickerSymbol"),
            // Row 8: Annual Revenue | Ownership
            E("Annual Revenue", account.annualRevenue ? `$${account.annualRevenue.toLocaleString()}` : acctSfDollar("AnnualRevenue"), "annualRevenue", "number", { rawValue: account.annualRevenue ?? null }),
            E("Ownership", ownershipDisplay, "Ownership"),
            // Row 9: SSN | Employees
            E("SSN", acctSf("SSN__c"), "SSN__c"),
            E("Employees", employeesDisplay, "numberOfEmployees", "number", { rawValue: account.numberOfEmployees ?? null }),
            // Row 10: EIN Number / Tax Id | SIC Code
            E("EIN Number / Tax Id", account.ein ?? acctSf("EIN_Number_Tax_Id__c"), "ein", "text", { rawValue: account.ein }),
            E("SIC Code", sicCodeDisplay, "Sic"),
            // Row 11: Lead Number | Total Debt
            E("Lead Number", acctSf("Lead_Number__c") ?? acctSf("Lead_Id__c") ?? acctSf("LeadId"), "Lead_Number__c"),
            ["Total Debt", totalDebtSfDisplay],
            // Row 12: Program Start Date | Current Balance
            E("Program Start Date", account.programStartDate?.toLocaleDateString() ?? acctSfDate("Program_Start_Date__c"), "programStartDate", "date", { rawValue: account.programStartDate ?? null }),
            ["Current Balance", currentBalanceDisplay],
            // Row 13: Program End Date | Creditor Type
            E("Program End Date", account.programEndDate?.toLocaleDateString() ?? acctSfDate("Program_End_Date__c"), "programEndDate", "date", { rawValue: account.programEndDate ?? null }),
            E("Creditor Type", creditorTypeDisplay, "Creditor_Type__c"),
            // Row 14: External SAS Id | Account Record Type
            E("External SAS Id", account.externalSasId ?? acctSf("External_SAS_Id__c"), "externalSasId", "text", { rawValue: account.externalSasId }),
            ["Account Record Type", accountRecordTypeDisplay],
            // Row 15: External RAM Id | Primary Contact
            E("External RAM Id", acctSf("External_RAM_Id__c") ?? acctSf("RAM_Id__c"), "externalRamId", "text", { rawValue: account.externalRamId }),
            ["Primary Contact", primaryContactNode],
            // Row 16: External Citadel Id | Synced DateTime
            E("External Citadel Id", acctSf("External_Citadel_Id__c"), "External_Citadel_Id__c"),
            ["Synced DateTime", syncedDateTimeDisplay],
            // Row 17: Sync Status | Closer
            ["Sync Status", acctSf("Sync_Status__c")],
            E("Closer", closerDisplay, "Closer__c"),
            // Row 18: Bank Account Sync | First Draft Date
            ["Bank Account Sync", account.bankAccountSyncStatus ?? acctSf("Bank_Account_Sync_Status__c")],
            E("First Draft Date", firstDraftDateDisplay, "First_Draft_Date__c", "date"),
            // Row 19: Client Number | First Contract Signed Date
            ["Client Number", acctSf("Client_Number__c")],
            E("First Contract Signed Date", acctSfDate("First_Contract_Signed_Date__c"), "First_Contract_Signed_Date__c", "date"),
            // Row 20: Last Contacted DateTime | First Payment Completed Date
            ["Last Contacted DateTime", lastContactedDateTimeDisplay],
            ["First Payment Completed Date", firstPaymentCompletedDateDisplay],
            // Row 20: Week Days Between Last Activity Date | Last Called Time
            ["Week Days Between Last Activity Date", weekDaysBetweenLastActivityDisplay],
            ["Last Called Time", lastCalledTimeDisplay],
            // Row 21: Legal Status | Last Emailed Time
            E("Legal Status", account.legalStatus ?? acctSf("Legal_Status__c"), "legalStatus", "text", { rawValue: account.legalStatus }),
            ["Last Emailed Time", lastEmailedTimeDisplay],
            // Row 22: Negotiation Status | Last SMS Time
            E("Negotiation Status", acctSf("NegotiationStatus__c"), "NegotiationStatus__c"),
            ["Last SMS Time", lastSMSTimeDisplay],
            // Row 23: HIGH UCC RISK | Last Synced By
            E("HIGH UCC RISK", acctSfBool("HIGH_UCC_RISK__c") ?? (account.highUccRisk ? "Yes" : "No"), "highUccRisk", "checkbox", { rawValue: account.highUccRisk ?? null }),
            ["Last Synced By", lastSyncedByDisplay],
            // Row 24: Qualified Financial | Last Synced Date Time
            E("Qualified Financial", acctSfBool("Qualified_Financial__c"), "Qualified_Financial__c", "checkbox"),
            ["Last Synced Date Time", lastSyncedDateTimeDisplay],
            // Row 25: Creditor Lien Risk | Collection Agency
            E("Creditor Lien Risk", acctSf("Creditor_Lien_Risk__c"), "Creditor_Lien_Risk__c"),
            E("Collection Agency", collectionAgencyDisplay, "collectionAgency", "text", { rawValue: account.collectionAgency }),
            // Row 26: Debt Negotiator | Program Completion Stage
            E("Debt Negotiator", acctSf("Debt_Negotiator__c"), "Debt_Negotiator__c"),
            ["Program Completion Stage", programCompletionStageDisplay],
            // Row 27: Cancellation Reason | Legal Network
            E("Cancellation Reason", account.cancellationReason ?? acctSf("Cancellation_Reason__c"), "cancellationReason", "text", { rawValue: account.cancellationReason }),
            E("Legal Network", legalNetworkDisplay, "Legal_Network__c"),
            // Row 28: Work Phone | Legal Network Sync Status
            E("Work Phone", acctSf("Work_Phone__c"), "Work_Phone__c", "phone"),
            ["Legal Network Sync Status", legalNetworkSyncStatusDisplay],
            // Row 29: Billing Address | Shipping Address
            ["Billing Address", billingAddressNode],
            ["Shipping Address", shippingAddressNode],
            // Row 30: Billing County | (empty right)
            E("Billing County", billingCountyDisplay, "BillingCounty__c"),
            ["", null],
          ]}
        />

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
        {/* SF File Status section — pair-by-pair from SF Dakota Enterprises. */}
        <FieldGrid
          entityType="account"
          entityId={account.id}
          fields={[
            // Row 1: Client Status | Bank Account Status
            ["Client Status", account.clientStatus],
            ["Bank Account Status", account.bankAccountStatus],
            // Row 2: Payment Status | (empty right)
            ["Payment Status", account.paymentStatus],
            ["", null],
            // Row 3: Graduation Status | (empty right)
            ["Graduation Status", account.graduatedStatus ?? acctSf("Graduation_Status__c")],
            ["", null],
            // Row 4: Created By | Last Modified By
            ["Created By", createdByDisplay],
            ["Last Modified By", lastModifiedByDisplay],
          ]}
        />
        {/* Description (full width) — SF renders Description as a full-row
            below the File Status pair grid. */}
        <div style={{ padding: "8px 0", display: "grid", gridTemplateColumns: "16.5% 1fr 28px", gap: 8, alignItems: "start" }}>
          <div style={{ fontSize: 12, color: "#444444", paddingTop: 1 }}>Description</div>
          <div style={{ fontSize: 13, color: "#181818", whiteSpace: "pre-wrap" }}>
            {account.description ?? acctSf("Description") ?? ""}
          </div>
          <div />
        </div>
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
  // Real per-deal payment term (months). Prefer the signed program plan, then
  // the SF Payment_Term__c snapshot, else fall back to 6. A hardcoded 6 here
  // produced wrong draft amounts for any deal not on a 6-month term.
  let oppSfData: Record<string, unknown> = {};
  try { oppSfData = activeOpp?.sfDataJson ? JSON.parse(activeOpp.sfDataJson) as Record<string, unknown> : {}; } catch { /* empty */ }
  const sfTerm = oppSfData["Payment_Term__c"] != null ? Number(oppSfData["Payment_Term__c"]) : NaN;
  const reschedTermMonths =
    account.programPlans[0]?.termMonths ||
    (Number.isFinite(sfTerm) && sfTerm > 0 ? sfTerm : 0) ||
    6;
  // SF model: once a program plan exists, the calculator tab IS the live
  // payment management grid (real drafts, fee split, running balance,
  // skip/edit/charge). The projection calculator stays available below it.
  const livePlan = account.programPlans.find((p) => p.drafts.length > 0);
  const projectionCalc = activeOpp ? (
    <RescheduleCalculator
      initial={{
        totalDebt: activeOpp.totalDebt ?? totalDebt,
        termMonths: reschedTermMonths,
        noOfDebts: activeOpp._count?.debts ?? activeOpp.debts.length,
        currentWeeklyPayment: activeOpp.currentWeeklyPayment ?? 0,
        firstPaymentDate: (account.programPlans[0]?.firstDraftDate ?? account.programStartDate)
          ? (account.programPlans[0]?.firstDraftDate ?? account.programStartDate)!.toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      }}
    />
  ) : (
    <div style={{ padding: 24, textAlign: "center", color: "#747474" }}>
      No active opportunity. Create one first to use the payment calculator.
    </div>
  );
  // SF Reschedule Program header values, read from the live plan + deal (the
  // SF panel shows the program parameters above the real schedule).
  const liveWeekly = livePlan
    ? (livePlan.monthlyAmount || livePlan.drafts.find((d) => d.status === "SCHEDULED")?.amount || livePlan.drafts[0]?.amount || 0)
    : 0;
  const liveParams: Array<[string, string]> = livePlan
    ? [
        ["No of Debts Included", String(allDebts.length)],
        ["Current Total Debt", `$${(activeOpp?.currentTotalDebt ?? totalDebt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ["Total Debt Included", `$${(activeOpp?.totalDebt ?? totalDebt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ["Service Fee", "$55.00"],
        ["Payment Processor", account.paymentProcessor ?? "SAS Processor"],
        ["Monthly Bank Fee", "$15.00"],
        ["Bank Setup Fee", "$10.00"],
        ["Frequency", "Weekly"],
        ["Payment Term", `${livePlan.termMonths}`],
        ["Weekly Draft", `$${liveWeekly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ["First Payment Date", (livePlan.firstDraftDate ?? livePlan.startDate).toLocaleDateString("en-US")],
        ["Weekly Payment Day", (livePlan.firstDraftDate ?? livePlan.startDate).toLocaleDateString("en-US", { weekday: "long" })],
      ]
    : [];
  const calcPanel = livePlan ? (
    <>
      <Section title="Reschedule Program">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 14 }}>
          {liveParams.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#444444", marginBottom: 4 }}>{label}</div>
              <div style={{ height: 32, padding: "0 8px", border: "1px solid #c9c7c5", borderRadius: 4, fontSize: 13, background: "#f3f2f2", color: "#444444", display: "flex", alignItems: "center" }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 8, fontSize: 12 }}>
          <Link href={`/program-plans/${livePlan.id}`} style={{ color: "#0176d3" }}>Open Program Plan</Link>
        </div>
        <LivePaymentGrid
          programPlanId={livePlan.id}
          drafts={[...livePlan.drafts]
            .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
            .map((d) => ({
              id: d.id,
              scheduledDate: d.scheduledDate.toISOString(),
              amount: d.amount,
              status: d.status,
              feeProgram: d.feeProgram,
              feeRetainer: d.feeRetainer,
              feeSetup: d.feeSetup,
              feeBank: d.feeBank,
              feeService: d.feeService,
              feeLegal: d.feeLegal,
              escrowAmount: d.escrowAmount,
              kind: d.kind,
              splitGroupId: d.splitGroupId,
              splitIndex: d.splitIndex,
              processorSyncStatus: d.processorSyncStatus,
            }))}
        />
      </Section>
      <Section title="Reschedule Program (Projection)" defaultOpen={false}>
        {projectionCalc}
      </Section>
    </>
  ) : (
    <Section title="Reschedule Program">{projectionCalc}</Section>
  );

  // SF Related tab parity: Files + Notes cards first, two-across tiles.
  const noteDocs = account.documents.filter((d) => d.type === "NOTE");
  const fileDocs = account.documents.filter((d) => d.type !== "NOTE");
  const noteTiles = await Promise.all(
    noteDocs.slice(0, 6).map(async (n) => {
      let snippet = "";
      try {
        const fsMod = await import("node:fs/promises");
        const raw = await fsMod.readFile(n.filePath, "utf8");
        snippet = raw.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
      } catch { /* file missing locally - snippet stays empty */ }
      return {
        id: n.id,
        title: n.name.replace(/\.snote$/i, ""),
        href: `/api/accounts/${account.id}/documents/${n.id}?view=1`,
        date: n.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        snippet,
      };
    }),
  );
  const fileTiles = fileDocs.slice(0, 6).map((f) => ({
    id: f.id,
    name: f.name,
    ext: f.name.split(".").pop()?.toLowerCase() ?? "",
    href: `/api/accounts/${account.id}/documents/${f.id}?view=1`,
    date: f.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  }));


  const activitiesPanel = (
    <>
    <NotesCard notes={noteTiles} total={noteDocs.length} />
    <Section title={`Activities (${activity.length})`}>
      {activity.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#747474" }}>No activity recorded.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
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
                <td style={td}>{a.meta ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
    </>
  );

  const documentsPanel = (
    <>
      <Section title={`Files (${fileDocs.length})`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {fileDocs.map((f) => (
            <a
              key={f.id}
              href={`/api/accounts/${account.id}/documents/${f.id}?view=1`}
              target="_blank"
              style={{ display: "flex", gap: 10, alignItems: "center", border: "1px solid #e5e5e5", borderRadius: 6, padding: "8px 10px", textDecoration: "none", background: "#fff" }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, background: (f.name.toLowerCase().endsWith(".pdf") ? "#ea001e" : "#0176d3"), color: "#fff", fontSize: 9, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>
                {f.name.split(".").pop()?.slice(0, 4) ?? "file"}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: "#0176d3", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span>
                <span style={{ color: "#747474", fontSize: 11 }}>{f.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </span>
            </a>
          ))}
        </div>
        <DocumentsUpload
          endpoint={`/api/accounts/${account.id}/documents`}
          items={[]}
        />
      </Section>
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
    </>
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

  // SF Related Records order (verified in the Debt Settlement app):
  // Debt Details -> Opportunities -> Account Team -> Files -> Notes -> History.
  const relatedPanel = (
    <>
      <RelatedList
        entity="Opportunity"
        title="Debt Details (Account)"
        items={allDebts}
        header={
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr 1fr 1fr 1fr 1fr", gap: 8, fontWeight: 700, fontSize: 11, color: "#444444", textTransform: "uppercase", letterSpacing: 0.4 }}>
            <div>Debt Amount</div><div>Creditor Name</div><div>Account #</div><div>Payment</div><div>Legal Status</div><div>Negotiation</div><div>Lien Position</div>
          </div>
        }
        renderItem={(d) => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr 1fr 1fr 1fr 1fr", gap: 8 }}>
            <Link href={`/debts/${d.id}`} style={{ color: "#0176d3" }}>
              ${d.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Link>
            <span>{d.creditorName}</span>
            <span>{d.accountNumber ?? "-"}</span>
            <span>{d.paymentAmount != null ? `$${d.paymentAmount.toLocaleString()}` : "-"}</span>
            <span>{d.legalStatus ?? "-"}</span>
            <span>{d.negotiationStatus ?? "-"}</span>
            <span>{d.lienPosition ?? "-"}</span>
          </div>
        )}
        emptyHint="No debts."
      />
      <RelatedList
        entity="Opportunity"
        title="Opportunities"
        items={account.opportunities}
        renderItem={(o) => (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 12 }}>
            <Link href={`/opportunities/${o.id}`} style={{ color: "#0176d3" }}>{o.name ?? o.recordType.replace(/_/g, " ")}</Link>
            <span>{o.stage}</span>
            <span>${(o.totalDebt ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
        emptyHint="No opportunities."
      />
      <AccountTeamCard ownerName={account.owner?.name ?? null} ownerEmail={account.owner?.email ?? null} members={teamMembers} />
      <FilesCard files={fileTiles} total={fileDocs.length} />
      <NotesCard notes={noteTiles} total={noteDocs.length} />
      <LeadHistoryCard
        rows={account.history.map((h) => ({
          id: h.id,
          field: h.field,
          oldValue: h.oldValue,
          newValue: h.newValue,
          changedBy: h.changedBy,
          changedAt: h.changedAt,
        }))}
        entityLabel="Account History"
        emptyHint="No history."
      />
    </>
  );

  const paymentSummaryLines = await prisma.paymentSummaryLine.findMany({
    where: { accountId: account.id },
    orderBy: { sortOrder: "asc" },
  });

  const paymentSummariesPanel = (
    <>
      <RelatedList
        entity="Draft"
        title="Payment Summaries (Related Record)"
        items={paymentSummaryLines}
        header={
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 1fr 1fr 1fr 1fr", gap: 8, fontWeight: 700, fontSize: 11, color: "#444444", textTransform: "uppercase", letterSpacing: 0.4 }}>
            <div>Payment Type</div><div>Recipient</div><div>Total Amount</div><div>Amount In Schedule</div><div>Amount Collected</div><div>Outstanding Amount</div>
          </div>
        }
        renderItem={(l) => (
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 1fr 1fr 1fr 1fr", gap: 8 }}>
            <span>{l.paymentType}</span>
            <span>{l.recipient ?? "-"}</span>
            <span>${l.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span>${l.amountInSchedule.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span>${l.amountCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span>${l.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
        emptyHint="No payment summaries synced yet."
      />
      <SasDetailsPanel accountId={account.id} />
    </>
  );

  const settlementsPanel = (
    <Section title="Settlements">
      {allDebts.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#747474" }}>No debt records yet.</div>
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
        <div style={{ padding: 24, textAlign: "center", color: "#747474" }}>No opportunities yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafaf9", borderBottom: "1px solid #c9c9c9" }}>
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
                  <Link href={`/opportunities/${o.id}`} style={{ color: "#0176d3" }}>{o.name ?? o.recordType.replace(/_/g, " ")}</Link>
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
      // SF Lightning shows the TOTAL DEBT dollar amount as the Account record
      // title (verified against the live org); the account name is the
      // subtitle since our chrome has no workspace tab to carry it.
      recordTitle={headerTitle}
      recordSubtitle={account.name}
      highlights={[
        // SF shows plain text in the highlights strip - no colored pills.
        { label: "Client Status", value: account.clientStatus },
        { label: "Processor Status", value: processorStatusDisplay ?? "Not Synced" },
        { label: "Payment Status", value: account.paymentStatus },
        { label: "Bank Account Status", value: account.bankAccountStatus },
      ]}
      actions={<AccountHeaderButtons accountId={account.id} currentStage={account.stage} defaultEmail={emailVal} defaultPhone={phoneVal} />}
      pathStages={PATH}
      pathCurrentIndex={accountPathIndex(account.stage)}
      details={
        <>
        <PathSidePanelServer
          entityType="Account"
          stage={account.stage}
          record={account as unknown as Record<string, unknown>}
        />
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
        </>
      }
      rail={
        <>
          {/* SF Debt Settlement app rail order (verified live):
              Health Check Results, Escrow Balance, Bank Details. */}
          <HealthCheckCard
            welcomeCallCompleted={welcomeCallDone}
            firstPaymentReceived={account.firstPaymentReceived || !!acctSf("First_Payment_Completed_Date__c")}
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
                <Link href={`/opportunities/${o.id}`} style={{ color: "#0176d3", fontWeight: 600, fontSize: 13 }}>
                  {o.name ?? o.recordType.replace(/_/g, " ")}
                </Link>
                <div style={{ color: "#444444", marginTop: 4 }}>
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
                <Link href={`/contacts/${rel.contact.id}`} style={{ color: "#0176d3", fontWeight: 600 }}>
                  {rel.contact.fullName}
                </Link>
                {rel.contact.email && (
                  <div style={{ fontSize: 11, color: "#747474" }}>{rel.contact.email}</div>
                )}
                {rel.contact.phone && (
                  <div style={{ fontSize: 11, color: "#747474" }}>{rel.contact.phone}</div>
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
          <ChecklistCard
            stage={account.stage}
            items={checklistTasks.map((t) => ({
              id: t.id,
              subject: t.subject,
              dueDate: t.dueDate?.toLocaleDateString("en-US") ?? null,
              assignedTo: t.owner?.name ?? null,
              done: t.status === "COMPLETED",
            }))}
          />
          <ActivityChatterRail activities={activity} chatter={chatter} accountId={account.id} defaultEmail={account.email ?? null} />
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
  color: "#444444",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  color: "#181818",
  fontSize: 13,
};
