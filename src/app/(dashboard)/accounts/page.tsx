import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import {
  SfListPage,
  type SfColumn,
  type SfRow,
} from "@/components/slds/sf-list-page";
import { ACCOUNT_RECORD_TYPES } from "@/lib/record-types";
import { InlineEditCell } from "@/components/lists/inline-edit-cell";
import { getInlineConfig } from "@/lib/lists/inline-editable-fields";

interface AccountsPageProps {
  searchParams: Promise<{
    recordType?: string;
    search?: string;
    sort?: string;
    dir?: string;
    view?: string;
  }>;
}

const LIMIT = 50;

// SF Business Accounts list columns (matches the SF screenshot Bar shared
// 2026-06-09): client status pill, first contact dates, primary contact,
// debt/payment/bank rollup fields, and the SF Lead Id custom column.
const COLUMNS: SfColumn[] = [
  { key: "clientStatus", label: "Client Status", width: 110, sortable: true },
  { key: "firstContact", label: "First Contact", width: 110, sortable: false },
  { key: "firstCommDate", label: "First Comm Date", width: 120, sortable: false },
  { key: "primaryContact", label: "Primary Contact", width: 170, sortable: false },
  { key: "name", label: "Account Name", width: 240, sortable: true },
  { key: "lastModified", label: "Last Modified", width: 110, sortable: false },
  { key: "lastContacted", label: "Last Contacted", width: 110, sortable: false },
  { key: "subDisposition", label: "Sub Disposition", width: 180, sortable: false },
  { key: "totalDebt", label: "Total Debt", width: 110, sortable: false },
  { key: "paymentStatus", label: "Payment Status", width: 130, sortable: true },
  { key: "phone", label: "Phone", width: 150, sortable: true },
  { key: "bankStatus", label: "Bank Status", width: 130, sortable: false },
  { key: "leadId", label: "Lead Id", width: 100, sortable: false },
];

const SORT_MAP: Record<string, Prisma.AccountOrderByWithRelationInput> = {
  name: { name: "asc" },
  clientStatus: { clientStatus: "asc" },
  phone: { phone: "asc" },
  paymentStatus: { paymentStatus: "asc" },
};

const TYPE_LABEL: Record<string, string> = {
  CLIENT: "Client",
  CREDITOR: "Creditor",
  VENDOR: "Vendor",
  BUSINESS_ACCOUNT: "Business",
  PERSON_ACCOUNT: "Person",
  BUYOUT: "Buyout",
  OTHER: "Other",
};

// Mirrors the Salesforce Accounts list views Bar shared (2026-06-09). The
// filter criteria are best-effort maps from the SF view names onto our Account
// fields (Bar to correct any that are off); the per-rep owner lists (Angie
// Kelly, David Medina, ...) are generated dynamically from account owners.
const STATIC_VIEWS = [
  { value: "business", label: "Business Accounts" },
  { value: "client", label: "Client Accounts" },
  { value: "all", label: "All Accounts" },
  { value: "program-completion", label: "Accounts in Program Completion Stage" },
  { value: "active-nsf", label: "Active 1st/2nd NSF" },
  { value: "buyout-affiliate", label: "Buyout Affiliate" },
  { value: "cancelled-transfers", label: "Cancelled - Transfers" },
  { value: "cs-graduated", label: "CS Team's Accounts- Graduated" },
  { value: "high-ucc-risk", label: "HIGH UCC RISK" },
  { value: "my-account-teams", label: "My Accounts Teams" },
  { value: "my-active", label: "My Active Accounts" },
  { value: "my-cancelled", label: "My Cancelled Accounts" },
  { value: "my-open", label: "My Accounts" },
  { value: "recent", label: "Recently Viewed" },
  { value: "creditor", label: "Creditors" },
  { value: "vendor", label: "Vendors" },
  { value: "this-week", label: "This Week's New" },
  { value: "today-activity", label: "Today's Activity" },
];

const STATUS_PILL: Record<string, { bg: string; fg: string }> = {
  Active: { bg: "#defbe6", fg: "#176d2c" },
  Inactive: { bg: "#f2f2f2", fg: "#444656" },
  Hardship: { bg: "#fff4d6", fg: "#8a6d00" },
  Cancelled: { bg: "#feded2", fg: "#8e1f0b" },
};

function fmtDateShort(input: unknown): string {
  if (!input) return "";
  const s = String(input).trim();
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
}

function fmtMoney(input: unknown): string {
  if (input === null || input === undefined || input === "") return "";
  const n = typeof input === "number" ? input : Number(String(input).replace(/[,$]/g, ""));
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? "";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const view = params.view ?? "business";

  const session = await auth();
  const myId = session?.user?.id ?? "";

  const where: Prisma.AccountWhereInput = { isActive: true };
  if (params.recordType) where.recordType = params.recordType;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (view === "business") {
    where.recordType = "BUSINESS_ACCOUNT";
  } else if (view === "client") {
    where.recordType = "CLIENT";
  } else if (view === "creditor") {
    where.recordType = "CREDITOR";
  } else if (view === "vendor") {
    where.recordType = "VENDOR";
  } else if (view === "my-open" && myId) {
    where.ownerId = myId;
  } else if (view === "this-week") {
    where.createdAt = { gte: weekStart };
  } else if (view === "today-activity") {
    where.updatedAt = { gte: todayStart, lt: tomorrow };
  } else if (view === "program-completion") {
    // SF "Accounts in Program Completion Stage" → graduated/completed program.
    where.stage = "Graduated";
  } else if (view === "active-nsf") {
    // SF "Active 1st/2nd NSF" → active accounts currently in NSF.
    where.stage = "Active";
    where.paymentStatus = "NSF";
  } else if (view === "buyout-affiliate") {
    where.recordType = "BUYOUT";
  } else if (view === "cancelled-transfers") {
    where.stage = "Cancelled";
    where.cancellationReason = { contains: "Transfer", mode: "insensitive" };
  } else if (view === "cs-graduated") {
    // SF "CS Team's Accounts- Graduated". We don't have account-team membership
    // yet, so this currently filters by graduated stage only (Bar to refine).
    where.stage = "Graduated";
  } else if (view === "high-ucc-risk") {
    where.highUccRisk = true;
  } else if (view === "my-account-teams" && myId) {
    where.ownerId = myId;
  } else if (view === "my-active" && myId) {
    where.ownerId = myId;
    where.clientStatus = "Active";
  } else if (view === "my-cancelled" && myId) {
    where.ownerId = myId;
    where.clientStatus = "Cancelled";
  } else if (view.startsWith("owner:")) {
    where.ownerId = view.slice("owner:".length);
  }

  let orderBy: Prisma.AccountOrderByWithRelationInput = { updatedAt: "desc" };
  if (sort && SORT_MAP[sort]) {
    const key = Object.keys(SORT_MAP[sort])[0] as keyof Prisma.AccountOrderByWithRelationInput;
    orderBy = { [key]: dir } as Prisma.AccountOrderByWithRelationInput;
  }

  const [items, total, ownerRows] = await Promise.all([
    prisma.account.findMany({
      where,
      select: {
        id: true,
        name: true,
        recordType: true,
        phone: true,
        clientStatus: true,
        paymentStatus: true,
        bankAccountStatus: true,
        currentTotalDebt: true,
        updatedAt: true,
        createdAt: true,
        firstContractSignedDate: true,
        sfDataJson: true,
        primaryContact: { select: { id: true, firstName: true, lastName: true } },
        owner: { select: { id: true, name: true, email: true } },
        convertedFromLead: { select: { sfId: true } },
      },
      orderBy,
      take: LIMIT,
    }),
    prisma.account.count({ where }),
    // One entry per account owner → per-rep "owner" views (mirrors the SF
    // per-person list views like "Angie Kelly", "David Medina", ...).
    prisma.account.findMany({
      where: { isActive: true, ownerId: { not: null } },
      select: { ownerId: true, owner: { select: { name: true, email: true } } },
      distinct: ["ownerId"],
    }),
  ]);

  const ownerViews = ownerRows
    .filter((r) => r.ownerId)
    .map((r) => ({ value: `owner:${r.ownerId}`, label: r.owner?.name || r.owner?.email || "Unknown owner" }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const allViews = [...STATIC_VIEWS, ...ownerViews];

  const rows: SfRow[] = items.map((a) => {
    let sfData: Record<string, unknown> = {};
    if (a.sfDataJson) {
      try { sfData = JSON.parse(a.sfDataJson) as Record<string, unknown>; } catch { /* ignore */ }
    }

    let leadIdVal: string | null = null;
    const rawLead = sfData.Lead_Id__c ?? sfData.LeadId__c ?? sfData.LeadId ?? sfData.Lead_Id;
    if (rawLead != null && rawLead !== "") leadIdVal = String(rawLead);
    if (!leadIdVal && a.convertedFromLead?.[0]?.sfId) leadIdVal = a.convertedFromLead[0].sfId;

    const primaryContactName =
      a.primaryContact
        ? `${a.primaryContact.firstName ?? ""} ${a.primaryContact.lastName ?? ""}`.trim() || (sfData.Primary_Contact_Name__c as string | undefined) || ""
        : (sfData.Primary_Contact_Name__c as string | undefined) ?? "";

    const clientStatus = a.clientStatus || (sfData.Client_Status__c as string) || "";
    const paymentStatus = a.paymentStatus || (sfData.Payment_Status__c as string) || "";
    const bankStatus = a.bankAccountStatus || (sfData.Bank_Account_Status__c as string) || "";
    const subDisp = (sfData.Sub_Disposition__c as string) || "";
    const totalDebt = a.currentTotalDebt ?? Number(sfData.Total_Debt__c);
    const firstContact = fmtDateShort(sfData.First_Payment_Completed_Date__c ?? sfData.First_Draft_Date__c ?? a.createdAt);
    const firstCommDate = fmtDateShort(a.firstContractSignedDate ?? sfData.First_Contract_Signed_Date__c);
    const lastContacted = fmtDateShort(sfData.Last_Contacted_DateTime__c);

    const pill = STATUS_PILL[clientStatus];
    const clientStatusCell = clientStatus ? (
      <span
        style={{
          display: "inline-flex",
          padding: "2px 8px",
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 600,
          background: pill?.bg ?? "#e9ecf3",
          color: pill?.fg ?? "#444656",
        }}
      >
        {clientStatus}
      </span>
    ) : "";

    const nameCfg = getInlineConfig("account", "name");

    return {
      id: a.id,
      href: `/accounts/${a.id}`,
      cells: [
        clientStatusCell,
        firstContact || "—",
        firstCommDate || "—",
        primaryContactName || "—",
        nameCfg ? (
          <InlineEditCell key="name" entity="account" recordId={a.id} config={nameCfg} value={a.name} />
        ) : (a.name || "—"),
        fmtDateShort(a.updatedAt) || "—",
        lastContacted || "—",
        subDisp || "—",
        fmtMoney(totalDebt) || "—",
        paymentStatus || "—",
        a.phone ? (
          <a
            key="phone"
            href={`tel:${a.phone}`}
            style={{ color: "#1589ee", textDecoration: "none" }}
          >
            {a.phone}
          </a>
        ) : (
          "—"
        ),
        bankStatus || "—",
        leadIdVal ?? "—",
      ],
    };
  });

  const preservedParams: Record<string, string> = {};
  if (params.recordType) preservedParams.recordType = params.recordType;
  if (params.view) preservedParams.view = params.view;

  const subtitle = allViews.find((v) => v.value === view)?.label ?? "Business Accounts";

  return (
    <SfListPage
      entity="account"
      title="Accounts"
      subtitle={subtitle}
      count={total}
      iconColor="#7f8de1"
      iconSlug="account"
      actions={[
        { label: "New" },
        { label: "Import" },
        { label: "Discover Companies" },
        { label: "Intelligence View" },
      ]}
      columns={COLUMNS}
      rows={rows}
      pathname="/accounts"
      sortKey={sort || undefined}
      sortDir={dir}
      searchQuery={search}
      preservedParams={preservedParams}
      views={allViews}
      currentView={view}
      massConfig={{
        entity: "account",
        statusField: "recordType",
        statusLabel: "Type",
        statusOptions: ACCOUNT_RECORD_TYPES.map((rt) => ({
          value: rt,
          label: TYPE_LABEL[rt] ?? rt,
        })),
      }}
    />
  );
}
