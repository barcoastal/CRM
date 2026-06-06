import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { SfListPage, ownerAlias, type SfColumn, type SfListViewOption } from "@/components/slds/sf-list-page";

interface LeadsPageProps {
  searchParams: Promise<{
    view?: string;
    q?: string;
  }>;
}

type LeadRow = {
  id: string;
  sfId: string | null;
  businessName: string;
  contactName: string;
  phone: string;
  email: string | null;
  status: string;
  source: string;
  recordType: string;
  subDisposition: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  createdAt: string;
};

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const view = params.view ?? "";

  const where: Prisma.LeadWhereInput = {};

  // View filter mapping. Only "Recently Viewed" (default), "All Leads",
  // "My Leads", "This Week's New Leads" are wired to filter logic.
  let orderBy: Prisma.LeadOrderByWithRelationInput = { createdAt: "desc" };
  if (view === "this_weeks_new_leads") {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    where.createdAt = { gte: weekAgo };
    orderBy = { createdAt: "desc" };
  } else if (view === "all_leads") {
    orderBy = { businessName: "asc" };
  }

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy,
      take: 50,
    }),
    prisma.lead.count({ where }),
  ]);

  const rows: LeadRow[] = items.map((lead) => {
    let subDisposition: string | null = null;
    try {
      if (lead.sfDataJson) {
        const sf = JSON.parse(lead.sfDataJson) as Record<string, unknown>;
        const sub = sf["Sub_Disposition__c"];
        if (typeof sub === "string" && sub.length > 0) subDisposition = sub;
      }
    } catch {
      /* ignore */
    }
    return {
      id: lead.id,
      sfId: lead.sfId,
      businessName: lead.businessName,
      contactName: lead.contactName,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      source: lead.source,
      recordType: lead.recordType,
      subDisposition,
      assignedTo: lead.assignedTo
        ? { id: lead.assignedTo.id, name: lead.assignedTo.name, email: lead.assignedTo.email }
        : null,
      createdAt: lead.createdAt.toISOString(),
    };
  });

  const columns: SfColumn<LeadRow>[] = [
    {
      key: "name",
      label: "Name",
      render: (r) => r.contactName || r.businessName,
      sortValue: (r) => r.contactName || r.businessName,
      searchText: (r) => r.contactName,
    },
    {
      key: "leadId",
      label: "Lead ID",
      render: (r) => r.sfId ?? r.id.slice(-7),
      sortValue: (r) => r.sfId ?? r.id,
      searchText: (r) => r.sfId,
    },
    {
      key: "company",
      label: "Company",
      render: (r) => r.businessName,
      sortValue: (r) => r.businessName,
      searchText: (r) => r.businessName,
    },
    {
      key: "phone",
      label: "Phone",
      render: (r) =>
        r.phone ? (
          <a href={`tel:${r.phone}`} style={{ color: "#1589ee", textDecoration: "none" }}>
            {formatPhone(r.phone)}
          </a>
        ) : (
          ""
        ),
      sortValue: (r) => r.phone,
      searchText: (r) => r.phone,
    },
    {
      key: "email",
      label: "Email",
      render: (r) =>
        r.email ? (
          <a href={`mailto:${r.email}`} style={{ color: "#1589ee", textDecoration: "none" }}>
            {r.email}
          </a>
        ) : (
          ""
        ),
      sortValue: (r) => r.email,
      searchText: (r) => r.email,
    },
    {
      key: "status",
      label: "Lead Status",
      render: (r) => formatLabel(r.status),
      sortValue: (r) => r.status,
      searchText: (r) => r.status,
    },
    {
      key: "source",
      label: "Lead Source",
      render: (r) => formatLabel(r.source),
      sortValue: (r) => r.source,
      searchText: (r) => r.source,
    },
    {
      key: "subDisposition",
      label: "Sub-Disposition",
      render: (r) => r.subDisposition ?? "",
      sortValue: (r) => r.subDisposition,
      searchText: (r) => r.subDisposition,
    },
    {
      key: "ownerAlias",
      label: "Owner Alias",
      render: (r) => (
        <span style={{ color: "#1589ee" }}>{ownerAlias(r.assignedTo)}</span>
      ),
      sortValue: (r) => ownerAlias(r.assignedTo),
      searchText: (r) => ownerAlias(r.assignedTo),
    },
  ];

  const views: SfListViewOption[] = [
    { label: "Recently Viewed", value: "", active: view === "" },
    { label: "All Leads", value: "all_leads", active: view === "all_leads" },
    { label: "My Leads", value: "my_leads", active: view === "my_leads" },
    { label: "This Week's New Leads", value: "this_weeks_new_leads", active: view === "this_weeks_new_leads" },
  ];

  return (
    <SfListPage
      entity="lead"
      iconSlug="lead"
      iconColor="#f88962"
      title="Leads"
      subtitle={views.find((v) => v.active)?.label ?? "Recently Viewed"}
      count={total}
      actions={[
        { label: "New", href: "/leads/new" },
        { label: "Intake Form", href: "/leads/new?intake=1" },
        { label: "Change Owner" },
        { label: "Change Status" },
        { label: "Send Email" },
      ]}
      rowHref={(r) => `/leads/${r.id}`}
      columns={columns}
      rows={rows}
      views={views}
    />
  );
}

function formatLabel(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
