import { prisma } from "@/lib/prisma";
import { ACCOUNT_RECORD_TYPES } from "@/lib/record-types";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";

interface AccountsPageProps {
  searchParams: Promise<{ recordType?: string; q?: string; page?: string }>;
}

const LIMIT = 25;

const RECORD_TYPE_LABEL: Record<string, string> = {
  CLIENT: "Client", CREDITOR: "Creditor", VENDOR: "Vendor",
  BUSINESS_ACCOUNT: "Business", PERSON_ACCOUNT: "Person", BUYOUT: "Buyout", OTHER: "Other",
};

type AccountRow = {
  id: string;
  name: string;
  recordType: string;
  email: string | null;
  phone: string | null;
  owner: { id: string; name: string } | null;
  industry: string | null;
  updatedAt: Date;
  _count: { contacts: number; opportunities: number };
};

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1"));
  const recordType =
    params.recordType && (ACCOUNT_RECORD_TYPES as readonly string[]).includes(params.recordType)
      ? params.recordType
      : undefined;
  const q = params.q?.trim() || undefined;

  const where: Record<string, unknown> = { isActive: true };
  if (recordType) where.recordType = recordType;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { ein: { contains: q } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.account.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { contacts: true, opportunities: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.account.count({ where }),
  ]);

  const viewName = recordType
    ? `${RECORD_TYPE_LABEL[recordType]} Accounts`
    : "All Accounts";

  const columns: ListViewColumn<AccountRow>[] = [
    {
      key: "name",
      label: "Account Name",
      render: (a) => a.name,
    },
    {
      key: "type",
      label: "Type",
      render: (a) => (
        <span
          style={{
            background: "#ecebea",
            color: "#080707",
            padding: "2px 8px",
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {RECORD_TYPE_LABEL[a.recordType] ?? a.recordType}
        </span>
      ),
    },
    { key: "phone", label: "Phone", render: (a) => a.phone ?? "—" },
    { key: "email", label: "Email", render: (a) => a.email ?? "—" },
    { key: "industry", label: "Industry", render: (a) => a.industry ?? "—" },
    {
      key: "contacts",
      label: "Contacts",
      render: (a) => a._count.contacts.toString(),
    },
    {
      key: "opps",
      label: "Opps",
      render: (a) => a._count.opportunities.toString(),
    },
    {
      key: "owner",
      label: "Account Owner",
      render: (a) => a.owner?.name ?? "—",
    },
  ];

  return (
    <ListView
      entity="Account"
      entityLabel="Accounts"
      viewName={viewName}
      totalCount={total}
      rows={items as AccountRow[]}
      columns={columns}
      rowHref={(a) => `/accounts/${a.id}`}
      newHref="/accounts/new"
    />
  );
}
