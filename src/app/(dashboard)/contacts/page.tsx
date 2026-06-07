import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";

interface ContactsPageProps {
  searchParams: Promise<{ q?: string; accountId?: string }>;
}

type ContactRow = {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  primaryAccount: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
};

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const params = await searchParams;
  const where: Record<string, unknown> = { isActive: true };
  if (params.accountId) where.primaryAccountId = params.accountId;
  if (params.q) {
    where.OR = [
      { fullName: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
      { phone: { contains: params.q } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        primaryAccount: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.contact.count({ where }),
  ]);

  const columns: ListViewColumn<ContactRow>[] = [
    { key: "name", label: "Name", render: (c) => c.fullName },
    { key: "title", label: "Title", render: (c) => c.title ?? "—" },
    {
      key: "account",
      label: "Account Name",
      render: (c) =>
        c.primaryAccount ? (
          <Link href={`/accounts/${c.primaryAccount.id}`} style={{ color: "#1589ee" }}>
            {c.primaryAccount.name}
          </Link>
        ) : "—",
    },
    { key: "email", label: "Email", render: (c) => c.email ?? "—" },
    { key: "phone", label: "Phone", render: (c) => c.phone ?? "—" },
    { key: "owner", label: "Owner", render: (c) => c.owner?.name ?? "—" },
  ];

  return (
    <ListView
      entity="Contact"
      entityLabel="Contacts"
      viewName="Recently Viewed"
      totalCount={total}
      rows={items as ContactRow[]}
      columns={columns}
      rowHref={(c) => `/contacts/${c.id}`}
      newHref="/contacts/new"
    />
  );
}
