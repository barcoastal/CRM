import { prisma } from "@/lib/prisma";
import { SfListPage, ownerAlias, type SfColumn, type SfListViewOption } from "@/components/slds/sf-list-page";

interface ContactsPageProps {
  searchParams: Promise<{ view?: string; accountId?: string }>;
}

type ContactRow = {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  primaryAccount: { id: string; name: string } | null;
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

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const params = await searchParams;
  const view = params.view ?? "";

  const where: Record<string, unknown> = { isActive: true };
  if (params.accountId) where.primaryAccountId = params.accountId;

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        title: true,
        email: true,
        phone: true,
        primaryAccount: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: view === "all_contacts"
        ? { fullName: "asc" }
        : { updatedAt: "desc" },
      take: 50,
    }),
    prisma.contact.count({ where }),
  ]);

  const rows: ContactRow[] = items;

  const columns: SfColumn<ContactRow>[] = [
    {
      key: "name",
      label: "Name",
      render: (c) => c.fullName,
      sortValue: (c) => c.fullName,
      searchText: (c) => c.fullName,
    },
    {
      key: "title",
      label: "Title",
      render: (c) => c.title ?? "",
      sortValue: (c) => c.title,
      searchText: (c) => c.title,
    },
    {
      key: "account",
      label: "Account Name",
      render: (c) =>
        c.primaryAccount ? (
          <a
            href={`/accounts/${c.primaryAccount.id}`}
            style={{ color: "#1589ee", textDecoration: "none" }}
          >
            {c.primaryAccount.name}
          </a>
        ) : (
          ""
        ),
      sortValue: (c) => c.primaryAccount?.name,
      searchText: (c) => c.primaryAccount?.name,
    },
    {
      key: "phone",
      label: "Phone",
      render: (c) =>
        c.phone ? (
          <a href={`tel:${c.phone}`} style={{ color: "#1589ee", textDecoration: "none" }}>
            {formatPhone(c.phone)}
          </a>
        ) : (
          ""
        ),
      sortValue: (c) => c.phone,
      searchText: (c) => c.phone,
    },
    {
      key: "email",
      label: "Email",
      render: (c) =>
        c.email ? (
          <a href={`mailto:${c.email}`} style={{ color: "#1589ee", textDecoration: "none" }}>
            {c.email}
          </a>
        ) : (
          ""
        ),
      sortValue: (c) => c.email,
      searchText: (c) => c.email,
    },
    {
      key: "ownerAlias",
      label: "Owner Alias",
      render: (c) => (
        <span style={{ color: "#1589ee" }}>{ownerAlias(c.owner)}</span>
      ),
      sortValue: (c) => ownerAlias(c.owner),
      searchText: (c) => ownerAlias(c.owner),
    },
  ];

  const views: SfListViewOption[] = [
    { label: "Recently Viewed", value: "", active: view === "" },
    { label: "All Contacts", value: "all_contacts", active: view === "all_contacts" },
    { label: "My Contacts", value: "my_contacts", active: view === "my_contacts" },
    { label: "New This Week", value: "new_this_week", active: view === "new_this_week" },
  ];

  return (
    <SfListPage
      entity="contact"
      iconSlug="contact"
      iconColor="#a094ed"
      title="Contacts"
      subtitle={views.find((v) => v.active)?.label ?? "Recently Viewed"}
      count={total}
      actions={[
        { label: "New", href: "/contacts/new" },
        { label: "Import" },
      ]}
      rowHref={(c) => `/contacts/${c.id}`}
      columns={columns}
      rows={rows}
      views={views}
    />
  );
}
