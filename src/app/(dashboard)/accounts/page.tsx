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
import { buildWhere, type ListFilter } from "@/lib/list-views";

interface AccountsPageProps {
  searchParams: Promise<{
    recordType?: string;
    search?: string;
    sort?: string;
    dir?: string;
    view?: string;
    page?: string;
  }>;
}

const LIMIT = 50;

// SF Account list columns — pulled verbatim from the SF Angie Kelly list view
// describe (2026-06-10). DO NOT add or remove columns without checking SF
// first — these match the SOQL columns SF returns for that view.
const COLUMNS: SfColumn[] = [
  { key: "ownerFullName", label: "Owner Full Name", width: 140, sortable: true },
  { key: "clientStatus", label: "Client Status", width: 110, sortable: true },
  { key: "firstContractSigned", label: "First Contract Signed Date", width: 150, sortable: false },
  { key: "primaryContact", label: "Primary Contact", width: 170, sortable: false },
  { key: "name", label: "Account Name", width: 240, sortable: true },
  { key: "lastModified", label: "Last Modified Date", width: 130, sortable: false },
  { key: "lastContacted", label: "Last Contacted DateTime", width: 150, sortable: false },
  { key: "subDisposition", label: "Sub Disposition", width: 180, sortable: false },
  { key: "totalDebt", label: "Total Debt", width: 110, sortable: false },
  { key: "paymentStatus", label: "Payment Status", width: 130, sortable: true },
  { key: "phone", label: "Phone", width: 150, sortable: true },
  { key: "billingState", label: "Billing State/Province", width: 130, sortable: false },
  { key: "leadNumber", label: "Lead Id", width: 100, sortable: false },
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

// The faithful Salesforce Account list views (incl. per-rep personal lists like
// Angie Kelly) live in the ListView table — seeded from the live SF export by
// prisma/seed-account-listviews.ts and applied below via buildWhere(). These
// COMPUTED_VIEWS are the few genuinely-dynamic views that can't be expressed as
// stored filters (they depend on the current user / current date).
const COMPUTED_VIEWS = [
  { value: "business", label: "Business Accounts" },
  { value: "my-open", label: "My Accounts" },
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
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const view = params.view ?? "business";

  const session = await auth();
  const myId = session?.user?.id ?? "";

  // Stored list views (system + the faithful SF recreations, incl. per-rep lists)
  const listViews = await prisma.listView.findMany({
    where: { entity: "Account" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true, developerName: true, filters: true },
  });

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

  if (view.startsWith("view:")) {
    // Stored list view — apply its saved filter criteria.
    const lv = listViews.find((v) => v.developerName === view.slice("view:".length));
    if (lv) Object.assign(where, buildWhere((lv.filters as unknown as ListFilter[]) ?? []));
  } else if (view === "business") {
    where.recordType = "BUSINESS_ACCOUNT";
  } else if (view === "client") {
    where.recordType = "CLIENT";
  } else if (view === "creditor") {
    where.recordType = "CREDITOR";
  } else if (view === "vendor") {
    where.recordType = "VENDOR";
  } else if ((view === "my-open" || view === "my-account-teams") && myId) {
    where.ownerId = myId;
  } else if (view === "this-week") {
    where.createdAt = { gte: weekStart };
  } else if (view === "today-activity") {
    where.updatedAt = { gte: todayStart, lt: tomorrow };
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
        billingState: true,
        sfDataJson: true,
        primaryContact: { select: { id: true, firstName: true, lastName: true } },
        owner: { select: { id: true, name: true, email: true } },
        convertedFromLead: { select: { sfId: true } },
      },
      orderBy,
      skip: (page - 1) * LIMIT,
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
  // Stored list views (system + SF recreations) drive the picker; their filters
  // are applied above via buildWhere(). COMPUTED_VIEWS + per-owner views follow.
  const dbViews = listViews
    .filter((v) => v.developerName)
    .map((v) => ({ value: `view:${v.developerName}`, label: v.name }));
  const allViews = [...dbViews, ...COMPUTED_VIEWS, ...ownerViews];

  const rows: SfRow[] = items.map((a) => {
    let sfData: Record<string, unknown> = {};
    if (a.sfDataJson) {
      try { sfData = JSON.parse(a.sfDataJson) as Record<string, unknown>; } catch { /* ignore */ }
    }

    let leadIdVal: string | null = null;
    // SF's "Angie Kelly" view uses Lead_Number__c. Fall back to legacy field
    // names + the converted Lead's sfId for older records.
    const rawLead =
      sfData.Lead_Number__c ?? sfData.Lead_Id__c ?? sfData.LeadId__c ?? sfData.LeadId ?? sfData.Lead_Id;
    if (rawLead != null && rawLead !== "") leadIdVal = String(rawLead);
    if (!leadIdVal && a.convertedFromLead?.[0]?.sfId) leadIdVal = a.convertedFromLead[0].sfId;

    const ownerFullName =
      a.owner?.name || (sfData.Owner_Full_Name__c as string | undefined) || a.owner?.email || "";
    const billingStateVal = a.billingState || (sfData.BillingStateCode as string | undefined) || "";

    const primaryContactName =
      a.primaryContact
        ? `${a.primaryContact.firstName ?? ""} ${a.primaryContact.lastName ?? ""}`.trim() || (sfData.Primary_Contact_Name__c as string | undefined) || ""
        : (sfData.Primary_Contact_Name__c as string | undefined) ?? "";

    const clientStatus = a.clientStatus || (sfData.Client_Status__c as string) || "";
    const paymentStatus = a.paymentStatus || (sfData.Payment_Status__c as string) || "";
    const subDisp = (sfData.Sub_Disposition__c as string) || "";
    const totalDebt = a.currentTotalDebt ?? Number(sfData.Total_Debt__c);
    const firstContractSigned = fmtDateShort(
      a.firstContractSignedDate ?? sfData.First_Contract_Signed_Date__c
    );
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
        ownerFullName || "—",
        clientStatusCell,
        firstContractSigned || "—",
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
        billingStateVal || "—",
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
      page={page}
      pageSize={LIMIT}
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
