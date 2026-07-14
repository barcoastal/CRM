import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
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
    view?: string;
    page?: string;
  }>;
}

const LIMIT = 50;

// SF Contact list columns (match docs/sf-screenshots/sf-contact-list.png):
// # | checkbox | Name | Title | Account Name | Phone | Email | Owner Alias
// SF Contact list columns (match docs/sf-screenshots/sf-contact-list.png):
// # | checkbox | Name | Account Name | Account Site | Phone | Email | Lead Id | Contact Owner Alias
const COLUMNS: SfColumn[] = [
  { key: "name", label: "Name", width: 200, sortable: true },
  { key: "account", label: "Account Name", width: 240, sortable: true },
  { key: "accountSite", label: "Account Site", width: 110, sortable: false },
  { key: "phone", label: "Phone", width: 150, sortable: true },
  { key: "email", label: "Email", width: 260, sortable: true },
  { key: "leadId", label: "Lead Id", width: 100, sortable: false },
  { key: "ownerAlias", label: "Contact Owner Alias", width: 150, sortable: true },
];

const SORT_MAP: Record<string, Prisma.ContactOrderByWithRelationInput> = {
  name: { fullName: "asc" },
  title: { title: "asc" },
  phone: { phone: "asc" },
  email: { email: "asc" },
};

const VIEWS = [
  { value: "recent", label: "Recently Viewed" },
  { value: "all", label: "All Contacts" },
  { value: "my-open", label: "My Contacts" },
  { value: "this-week", label: "This Week's New" },
  { value: "today-activity", label: "Today's Activity" },
];

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const sort = params.sort ?? "";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const view = params.view ?? "recent";

  const session = await auth();
  const myId = session?.user?.id ?? "";

  const where: Prisma.ContactWhereInput = { isActive: true };
  if (params.accountId) where.primaryAccountId = params.accountId;
  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
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
  } else if (view?.startsWith("owner:")) {
    // Admin drill-down: everything a specific user owns.
    where.ownerId = view.slice("owner:".length);
  } else if (view === "this-week") {
    where.createdAt = { gte: weekStart };
  } else if (view === "today-activity") {
    where.updatedAt = { gte: todayStart, lt: tomorrow };
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
        sfDataJson: true,
        primaryAccount: { select: { id: true, name: true, website: true } },
        owner: { select: { id: true, name: true, email: true } },
        convertedFromLead: { select: { sfId: true } },
      },
      orderBy,
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    prisma.contact.count({ where }),
  ]);

  const rows: SfRow[] = items.map((c) => {
    // Account Site — derived from the linked account's website host
    const acctSite = c.primaryAccount?.website
      ? c.primaryAccount.website
          .replace(/^https?:\/\/(www\.)?/i, "")
          .replace(/\/$/, "")
      : "";

    // Lead Id — prefer the SF "Lead_Id__c" custom field captured during
    // conversion; fall back to the original lead's SF id, then sfDataJson
    // top-level keys.
    let leadIdVal: string | null = null;
    if (c.sfDataJson) {
      try {
        const sfData = JSON.parse(c.sfDataJson) as Record<string, unknown>;
        const raw =
          sfData.Lead_Id__c ?? sfData.LeadId__c ?? sfData.LeadId ?? sfData.Lead_Id;
        if (raw != null && raw !== "") leadIdVal = String(raw);
      } catch {
        /* ignore */
      }
    }
    if (!leadIdVal && c.convertedFromLead?.[0]?.sfId) {
      leadIdVal = c.convertedFromLead[0].sfId;
    }

    return {
      id: c.id,
      href: `/contacts/${c.id}`,
      cells: [
        c.fullName || "—",
        c.primaryAccount ? (
          <Link
            key="acct"
            href={`/accounts/${c.primaryAccount.id}`}
            style={{ color: "#0176d3", textDecoration: "none" }}
            className="sf-row-link"
          >
            {c.primaryAccount.name}
          </Link>
        ) : (
          "—"
        ),
        acctSite || "—",
        c.phone ? (
          <a
            key="phone"
            href={`tel:${c.phone}`}
            style={{ color: "#0176d3", textDecoration: "none" }}
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
            style={{ color: "#0176d3", textDecoration: "none" }}
          >
            {c.email}
          </a>
        ) : (
          "—"
        ),
        leadIdVal ?? "—",
        ownerAlias(c.owner) || "—",
      ],
    };
  });

  const preservedParams: Record<string, string> = {};
  if (params.accountId) preservedParams.accountId = params.accountId;
  if (params.view) preservedParams.view = params.view;

  const subtitle = VIEWS.find((v) => v.value === view)?.label ?? "Recently Viewed";

  return (
    <SfListPage
      entity="contact"
      title="Contacts"
      subtitle={subtitle}
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
      views={VIEWS}
      currentView={view}
      page={page}
      pageSize={LIMIT}
      massConfig={{
        entity: "contact",
        // Contacts don't have a status field; only Change Owner / Send Email work
      }}
    />
  );
}
