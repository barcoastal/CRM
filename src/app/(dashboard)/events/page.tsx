import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { genericTone } from "@/lib/slds/status-tones";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { DayView } from "@/components/calendar/day-view";
import {
  type CalendarEventRow,
  type CalendarView,
  rangeFor,
  startOfWeek,
  addDays,
} from "@/components/calendar/calendar-helpers";
import { BulkActionBar } from "@/components/lists/bulk-action-bar";
import { InlineEditCell } from "@/components/lists/inline-edit-cell";
import { getInlineConfig } from "@/lib/lists/inline-editable-fields";
import { EVENT_STATUSES } from "@/lib/record-types";

type EventRow = {
  id: string;
  subject: string;
  status: string;
  startAt: Date;
  endAt: Date;
  location: string | null;
  recordType: string;
  account: { id: string; name: string } | null;
  contact: { id: string; fullName: string } | null;
  lead: { id: string; contactName: string } | null;
  owner: { id: string; name: string } | null;
};

interface PageProps {
  searchParams: Promise<{
    view?: string;
    date?: string;
    filter?: string;
    ownerId?: string;
  }>;
}

export default async function EventsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const viewParam = params.view ?? "month";

  if (viewParam === "list") {
    return <EventsListView />;
  }

  return <EventsCalendarView params={params} />;
}

async function EventsCalendarView({ params }: { params: { view?: string; date?: string; filter?: string; ownerId?: string } }) {
  const session = await auth();
  const sessionUserId = session?.user?.id ?? null;

  const view: CalendarView =
    params.view === "week" ? "week" : params.view === "day" ? "day" : "month";
  const anchor = params.date ? new Date(params.date) : new Date();
  // Guard against bad date input.
  const safeAnchor = isNaN(anchor.getTime()) ? new Date() : anchor;

  const filter = params.filter === "mine" || params.filter === "week" ? params.filter : "all";
  const ownerIdFilter = params.ownerId ?? null;

  const { from, to } = rangeFor(view, safeAnchor);

  // Filter widens the where clause; "week" overrides range to current week.
  const where: Record<string, unknown> = {
    startAt: { gte: from, lte: to },
  };
  if (filter === "mine" && sessionUserId) {
    where.ownerId = sessionUserId;
  } else if (ownerIdFilter) {
    where.ownerId = ownerIdFilter;
  }
  if (filter === "week") {
    const ws = startOfWeek(new Date());
    where.startAt = { gte: ws, lte: addDays(ws, 7) };
  }

  const [items, users] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        opportunity: { select: { id: true, recordType: true } },
        lead: { select: { id: true, contactName: true } },
        contact: { select: { id: true, fullName: true } },
      },
      orderBy: { startAt: "asc" },
      take: 1000,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const events: CalendarEventRow[] = items.map((e) => {
    let related: CalendarEventRow["related"] = { href: null, label: null, kind: null };
    if (e.account) {
      related = { href: `/accounts/${e.account.id}`, label: e.account.name, kind: "account" };
    } else if (e.opportunity) {
      related = { href: `/opportunities/${e.opportunity.id}`, label: e.opportunity.recordType ?? "Opportunity", kind: "opportunity" };
    } else if (e.lead) {
      related = { href: `/leads/${e.lead.id}`, label: e.lead.contactName, kind: "lead" };
    } else if (e.contact) {
      related = { href: `/contacts/${e.contact.id}`, label: e.contact.fullName, kind: "contact" };
    }
    return {
      id: e.id,
      subject: e.subject,
      status: e.status,
      recordType: e.recordType,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt.toISOString(),
      location: e.location,
      ownerId: e.ownerId,
      ownerName: e.owner?.name ?? null,
      related,
    };
  });

  const anchorISO = safeAnchor.toISOString();

  return (
    <div style={{ display: "flex", flexDirection: "column", background: "#fafaf9", minHeight: "100%" }}>
      <CalendarToolbar
        view={view}
        anchorISO={anchorISO}
        filter={filter}
        ownerId={ownerIdFilter}
        users={users}
      />
      {view === "month" && <MonthView anchorISO={anchorISO} events={events} />}
      {view === "week" && <WeekView anchorISO={anchorISO} events={events} />}
      {view === "day" && <DayView anchorISO={anchorISO} events={events} />}
    </div>
  );
}

async function EventsListView() {
  const items = await prisma.event.findMany({
    include: {
      account: { select: { id: true, name: true } },
      contact: { select: { id: true, fullName: true } },
      lead: { select: { id: true, contactName: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: { startAt: "desc" },
    take: 100,
  });
  const total = await prisma.event.count();

  const subjectCfg = getInlineConfig("event", "subject");
  const statusCfg = getInlineConfig("event", "status");

  const columns: ListViewColumn<EventRow>[] = [
    {
      key: "subject", label: "Subject",
      render: (e) => subjectCfg ? (
        <InlineEditCell entity="event" recordId={e.id} config={subjectCfg} value={e.subject} />
      ) : e.subject,
    },
    { key: "start", label: "Start", render: (e) => e.startAt.toLocaleString() },
    { key: "end", label: "End", render: (e) => e.endAt.toLocaleString() },
    { key: "loc", label: "Location", render: (e) => e.location ?? "-" },
    {
      key: "status", label: "Status",
      render: (e) => statusCfg ? (
        <InlineEditCell
          entity="event" recordId={e.id} config={statusCfg} value={e.status}
          display={<StatusPill label={e.status} tone={genericTone(e.status)} />}
        />
      ) : <StatusPill label={e.status} tone={genericTone(e.status)} />,
    },
    {
      key: "related",
      label: "Related",
      render: (e) =>
        e.account ? <Link href={`/accounts/${e.account.id}`} style={{ color: "#1589ee" }}>{e.account.name}</Link> :
        e.lead ? <Link href={`/leads/${e.lead.id}`} style={{ color: "#1589ee" }}>{e.lead.contactName}</Link> :
        e.contact ? <Link href={`/contacts/${e.contact.id}`} style={{ color: "#1589ee" }}>{e.contact.fullName}</Link> : "-",
    },
    { key: "owner", label: "Owner", render: (e) => e.owner?.name ?? "-" },
  ];

  return (
    <div>
      <div style={{ padding: "8px 16px", background: "#fff", borderBottom: "1px solid #ecebea", display: "flex", justifyContent: "flex-end" }}>
        <a href="/events" style={{ color: "#0070d2", fontSize: 13, textDecoration: "none" }}>Back to calendar</a>
      </div>
      <ListView
        entity="Event"
        entityLabel="Events"
        viewName="All Events"
        totalCount={total}
        rows={items as EventRow[]}
        columns={columns}
        rowHref={(e) => `/events/${e.id}`}
        selectable
        bulkBar={(
          <BulkActionBar
            entity="event"
            ownerField="ownerId"
            statusField="status"
            statusLabel="Status"
            statusOptions={EVENT_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        )}
      />
    </div>
  );
}
