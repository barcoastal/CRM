import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import {
  SfListPage,
  type SfColumn,
  type SfRow,
  ownerAlias,
} from "@/components/slds/sf-list-page";

interface ContactsPageProps {
  searchParams: Promise<{
    accountId?: string;
    search?: string;
    sort?: string;
    dir?: string;
  }>;
}

const LIMIT = 50;

// SF Contact list columns (match docs/sf-screenshots/sf-contact-list.png):
// # | checkbox | Name | Title | Account Name | Phone | Email | Owner Alias
const COLUMNS: SfColumn[] = [
  { key: "name", label: "Name", width: 200, sortable: true },
  { key: "title", label: "Title", width: 180, sortable: true },
  { key: "account", label: "Account Name", width: 240, sortable: true },
  { key: "phone", label: "Phone", width: 150, sortable: true },
  { key: "email", label: "Email", width: 260, sortable: true },
  { key: "ownerAlias", label: "Owner Alias", width: 110, sortable: true },
];

const SORT_MAP: Record<string, Prisma.ContactOrderByWithRelationInput> = {
  name: { fullName: "asc" },
  title: { title: "asc" },
  phone: { phone: "asc" },
  email: { email: "asc" },
};

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? "";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";

  const where: Prisma.ContactWhereInput = { isActive: true };
  if (params.accountId) where.primaryAccountId = params.accountId;
  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  let orderBy: Prisma.ContactOrderByWithRelationInput = { updatedAt: "desc" };
  if (sort && SORT_MAP[sort]) {
    const key = Object.keys(SORT_MAP[sort])[0] as keyof Prisma.ContactOrderByWithRelationInput;
    orderBy = { [key]: dir } as Prisma.ContactOrderByWithRelationInput;
  }

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
      orderBy,
      take: LIMIT,
    }),
    prisma.contact.count({ where }),
  ]);

  const rows: SfRow[] = items.map((c) => ({
    id: c.id,
    href: `/contacts/${c.id}`,
    cells: [
      c.fullName || "—",
      c.title ?? "",
      c.primaryAccount ? (
        <Link
          key="acct"
          href={`/accounts/${c.primaryAccount.id}`}
          style={{ color: "#1589ee", textDecoration: "none" }}
          className="sf-row-link"
        >
          {c.primaryAccount.name}
        </Link>
      ) : (
        "—"
      ),
      c.phone ? (
        <a
          key="phone"
          href={`tel:${c.phone}`}
          style={{ color: "#1589ee", textDecoration: "none" }}
        >
          {c.phone}
        </a>
      ) : (
        "—"
      ),
      c.email ? (
        <a
          key="email"
          href={`mailto:${c.email}`}
          style={{ color: "#1589ee", textDecoration: "none" }}
        >
          {c.email}
        </a>
      ) : (
        "—"
      ),
      ownerAlias(c.owner) || "—",
    ],
  }));

  const preservedParams: Record<string, string> = {};
  if (params.accountId) preservedParams.accountId = params.accountId;

  return (
    <SfListPage
      entity="contact"
      title="Contacts"
      subtitle="Recently Viewed"
      count={total}
      iconColor="#a094ed"
      iconSlug="contact"
      actions={[
        { label: "Import" },
        { label: "Send Email" },
        { label: "New" },
      ]}
      columns={COLUMNS}
      rows={rows}
      pathname="/contacts"
      sortKey={sort || undefined}
      sortDir={dir}
      searchQuery={search}
      preservedParams={preservedParams}
    />
  );
}
