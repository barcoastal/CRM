import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import {
  SfListPage,
  type SfColumn,
  type SfRow,
  ownerAlias,
} from "@/components/slds/sf-list-page";
import { ACCOUNT_RECORD_TYPES } from "@/lib/record-types";

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

// SF Account list columns (match docs/sf-screenshots/sf-account-list.png):
// # | checkbox | Account Name | Account Site | Phone | Account Owner Alias |
// Type | Industry | Billing State
const COLUMNS: SfColumn[] = [
  { key: "name", label: "Account Name", width: 260, sortable: true },
  { key: "site", label: "Account Site", width: 130, sortable: true },
  { key: "phone", label: "Phone", width: 150, sortable: true },
  { key: "ownerAlias", label: "Account Owner Alias", width: 160, sortable: true },
  { key: "type", label: "Type", width: 120, sortable: true },
  { key: "industry", label: "Industry", width: 160, sortable: true },
  { key: "billingState", label: "Billing State", width: 110, sortable: true },
];

const SORT_MAP: Record<string, Prisma.AccountOrderByWithRelationInput> = {
  name: { name: "asc" },
  phone: { phone: "asc" },
  type: { recordType: "asc" },
  industry: { industry: "asc" },
  billingState: { billingState: "asc" },
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

const VIEWS = [
  { value: "recent", label: "Recently Viewed" },
  { value: "all", label: "All Accounts" },
  { value: "my-open", label: "My Accounts" },
  { value: "this-week", label: "This Week's New" },
  { value: "today-activity", label: "Today's Activity" },
];

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? "";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const view = params.view ?? "recent";

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

  if (view === "my-open" && myId) {
    where.ownerId = myId;
  } else if (view === "this-week") {
    where.createdAt = { gte: weekStart };
  } else if (view === "today-activity") {
    where.updatedAt = { gte: todayStart, lt: tomorrow };
  }

  let orderBy: Prisma.AccountOrderByWithRelationInput = { updatedAt: "desc" };
  if (sort && SORT_MAP[sort]) {
    const key = Object.keys(SORT_MAP[sort])[0] as keyof Prisma.AccountOrderByWithRelationInput;
    orderBy = { [key]: dir } as Prisma.AccountOrderByWithRelationInput;
  }

  const [items, total] = await Promise.all([
    prisma.account.findMany({
      where,
      select: {
        id: true,
        name: true,
        recordType: true,
        phone: true,
        industry: true,
        billingState: true,
        website: true,
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy,
      take: LIMIT,
    }),
    prisma.account.count({ where }),
  ]);

  const rows: SfRow[] = items.map((a) => {
    // SF "Account Site" — we use website as a proxy when present
    const site = a.website
      ? a.website.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")
      : "";
    return {
      id: a.id,
      href: `/accounts/${a.id}`,
      cells: [
        a.name || "—",
        site || "",
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
        ownerAlias(a.owner) || "—",
        TYPE_LABEL[a.recordType] ?? a.recordType,
        a.industry ?? "",
        a.billingState ?? "",
      ],
    };
  });

  const preservedParams: Record<string, string> = {};
  if (params.recordType) preservedParams.recordType = params.recordType;
  if (params.view) preservedParams.view = params.view;

  const subtitle = VIEWS.find((v) => v.value === view)?.label ?? "Recently Viewed";

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
      views={VIEWS}
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
