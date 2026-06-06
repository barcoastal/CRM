import { prisma } from "@/lib/prisma";
import { SfListPage, ownerAlias, type SfColumn, type SfListViewOption } from "@/components/slds/sf-list-page";

interface AccountsPageProps {
  searchParams: Promise<{ view?: string }>;
}

const LIMIT = 50;

const RECORD_TYPE_LABEL: Record<string, string> = {
  CLIENT: "Client",
  CREDITOR: "Creditor",
  VENDOR: "Vendor",
  BUSINESS_ACCOUNT: "Business",
  PERSON_ACCOUNT: "Person",
  BUYOUT: "Buyout",
  OTHER: "Other",
};

type AccountRow = {
  id: string;
  name: string;
  recordType: string;
  phone: string | null;
  industry: string | null;
  billingState: string | null;
  billingCity: string | null;
  website: string | null;
  owner: { id: string; name: string; email: string } | null;
};

function formatPhone(phone: string | null): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = await searchParams;
  const view = params.view ?? "";

  const where: Record<string, unknown> = { isActive: true };

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
        billingCity: true,
        website: true,
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: view === "all_accounts"
        ? { name: "asc" }
        : { updatedAt: "desc" },
      take: LIMIT,
    }),
    prisma.account.count({ where }),
  ]);

  const rows: AccountRow[] = items;

  const columns: SfColumn<AccountRow>[] = [
    {
      key: "name",
      label: "Account Name",
      render: (a) => a.name,
      sortValue: (a) => a.name,
      searchText: (a) => a.name,
    },
    {
      key: "site",
      label: "Account Site",
      render: (a) => a.website ?? a.billingCity ?? "",
      sortValue: (a) => a.website ?? a.billingCity ?? "",
      searchText: (a) => a.website ?? a.billingCity,
    },
    {
      key: "phone",
      label: "Phone",
      render: (a) =>
        a.phone ? (
          <a href={`tel:${a.phone}`} style={{ color: "#1589ee", textDecoration: "none" }}>
            {formatPhone(a.phone)}
          </a>
        ) : (
          ""
        ),
      sortValue: (a) => a.phone,
      searchText: (a) => a.phone,
    },
    {
      key: "ownerAlias",
      label: "Account Owner Alias",
      render: (a) => (
        <span style={{ color: "#1589ee" }}>{ownerAlias(a.owner)}</span>
      ),
      sortValue: (a) => ownerAlias(a.owner),
      searchText: (a) => ownerAlias(a.owner),
    },
    {
      key: "type",
      label: "Type",
      render: (a) => RECORD_TYPE_LABEL[a.recordType] ?? a.recordType,
      sortValue: (a) => RECORD_TYPE_LABEL[a.recordType] ?? a.recordType,
      searchText: (a) => RECORD_TYPE_LABEL[a.recordType] ?? a.recordType,
    },
    {
      key: "industry",
      label: "Industry",
      render: (a) => a.industry ?? "",
      sortValue: (a) => a.industry,
      searchText: (a) => a.industry,
    },
    {
      key: "billingState",
      label: "Billing State",
      render: (a) => a.billingState ?? "",
      sortValue: (a) => a.billingState,
      searchText: (a) => a.billingState,
    },
  ];

  const views: SfListViewOption[] = [
    { label: "Recently Viewed", value: "", active: view === "" },
    { label: "All Accounts", value: "all_accounts", active: view === "all_accounts" },
    { label: "My Accounts", value: "my_accounts", active: view === "my_accounts" },
    { label: "New This Week", value: "new_this_week", active: view === "new_this_week" },
  ];

  return (
    <SfListPage
      entity="account"
      iconSlug="account"
      iconColor="#7f8de1"
      title="Accounts"
      subtitle={views.find((v) => v.active)?.label ?? "Recently Viewed"}
      count={total}
      actions={[
        { label: "New", href: "/accounts/new" },
        { label: "Import" },
      ]}
      rowHref={(a) => `/accounts/${a.id}`}
      columns={columns}
      rows={rows}
      views={views}
    />
  );
}
