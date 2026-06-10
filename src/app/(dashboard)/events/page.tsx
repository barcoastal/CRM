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
import { CalendarLegend } from "@/components/calendar/calendar-legend";
import { CalendarEmptyState } from "@/components/calendar/calendar-empty-state";
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
    ownerIds?: string;
  }>;
}

/**
 * Hard cap to keep "Everyone" / large team queries from returning
 * thousands of events and crashing the page.
 */
const MAX_USERS_PER_VIEW = 50;

export default async function EventsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const viewParam = params.view ?? "month";

  if (viewParam === "list") {
    return <EventsListView />;
  }

  return <EventsCalendarView params={params} />;
}

async function EventsCalendarView({
  params,
}: {
  params: {
    view?: string;
    date?: string;
    filter?: string;
    ownerId?: string;
    ownerIds?: string;
  };
}) {
  const session = await auth();
  const sessionUserId = session?.user?.id ?? null;

  const view: CalendarView =
    params.view === "week" ? "week" : params.view === "day" ? "day" : "month";
  const anchor = params.date ? new Date(params.date) : new Date();
  const safeAnchor = isNaN(anchor.getTime()) ? new Date() : anchor;

  const { from, to } = rangeFor(view, safeAnchor);

  // Load the active user directory once. Used both for the picker and to
  // expand "team" / "everyone" presets.
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, managerId: true },
    orderBy: { name: "asc" },
  });

  // Resolve which user IDs the calendar should overlay.
  const { ownerIds, presetUsed } = await resolveOwnerIds({
    rawOwnerIds: params.ownerIds,
    legacyOwnerId: params.ownerId,
    legacyFilter: params.filter,
    sessionUserId,
    allUsers: users,
  });

  // Backwards compat with the existing `filter=week` shortcut.
  const useWeekRange = params.filter === "week";

  const where: Record<string, unknown> = {
    startAt: useWeekRange
      ? { gte: startOfWeek(new Date()), lte: addDays(startOfWeek(new Date()), 7) }
      : { gte: from, lte: to },
  };

  if (ownerIds.length > 0) {
    where.ownerId = { in: ownerIds };
  } else {
    // Nothing selected. Return zero events so the empty state renders.
    where.ownerId = "__none__";
  }

  const items =
    ownerIds.length > 0
      ? await prisma.event.findMany({
          where,
          include: {
            owner: { select: { id: true, name: true } },
            account: { select: { id: true, name: true } },
            opportunity: { select: { id: true, recordType: true } },
            lead: { select: { id: true, contactName: true } },
            contact: { select: { id: true, fullName: true } },
          },
          orderBy: { startAt: "asc" },
          take: 2000,
        })
      : [];

  const events: CalendarEventRow[] = items.map((e) => {
    let related: CalendarEventRow["related"] = { href: null, label: null, kind: null };
    if (e.account) {
      related = { href: `/accounts/${e.account.id}`, label: e.account.name, kind: "account" };
    } else if (e.opportunity) {
      related = {
        href: `/opportunities/${e.opportunity.id}`,
        label: e.opportunity.recordType ?? "Opportunity",
        kind: "opportunity",
      };
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

  // Resolve picked-user names for the legend / pills.
  const usersById = new Map(users.map((u) => [u.id, u]));
  const selectedUsers = ownerIds
    .map((id) => usersById.get(id))
    .filter((u): u is (typeof users)[number] => Boolean(u))
    .map((u) => ({ id: u.id, name: u.name }));

  // Count distinct owners actually represented in the loaded events.
  const ownerSet = new Set(events.map((e) => e.ownerId).filter(Boolean) as string[]);

  return (
    <div style={{ display: "flex", flexDirection: "column", background: "#fafaf9", minHeight: "100%" }}>
      <CalendarToolbar
        view={view}
        anchorISO={anchorISO}
        ownerIds={ownerIds}
        preset={presetUsed}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        sessionUserId={sessionUserId}
        maxUsers={MAX_USERS_PER_VIEW}
      />
      <CalendarLegend
        users={selectedUsers}
        ownerIds={ownerIds}
        eventCount={events.length}
        uniqueOwnerCount={ownerSet.size}
      />
      {ownerIds.length === 0 ? (
        <CalendarEmptyState />
      ) : (
        <>
          {view === "month" && <MonthView anchorISO={anchorISO} events={events} />}
          {view === "week" && <WeekView anchorISO={anchorISO} events={events} />}
          {view === "day" && <DayView anchorISO={anchorISO} events={events} />}
        </>
      )}
    </div>
  );
}

/**
 * Resolve the `ownerIds` URL param into a concrete list of user ids.
 *
 * Supports:
 *   - `ownerIds=mine`   -> [sessionUserId]
 *   - `ownerIds=team`   -> [sessionUserId, ...direct reports]
 *   - `ownerIds=all`    -> every active user (capped at MAX_USERS_PER_VIEW)
 *   - `ownerIds=u1,u2`  -> the listed users (filtered to active)
 *   - empty             -> defaults to `mine`
 *
 * Also honors the legacy `ownerId=<single>` and `filter=mine` params so
 * existing bookmarks keep working.
 */
async function resolveOwnerIds({
  rawOwnerIds,
  legacyOwnerId,
  legacyFilter,
  sessionUserId,
  allUsers,
}: {
  rawOwnerIds: string | undefined;
  legacyOwnerId: string | undefined;
  legacyFilter: string | undefined;
  sessionUserId: string | null;
  allUsers: Array<{ id: string; managerId: string | null }>;
}): Promise<{ ownerIds: string[]; presetUsed: "mine" | "team" | "all" | "custom" | "none" }> {
  // 1. Legacy single-owner param wins if present and no new param.
  if (!rawOwnerIds && legacyOwnerId) {
    return { ownerIds: [legacyOwnerId], presetUsed: "custom" };
  }

  // 2. Legacy filter param.
  if (!rawOwnerIds && legacyFilter === "mine" && sessionUserId) {
    return { ownerIds: [sessionUserId], presetUsed: "mine" };
  }
  if (!rawOwnerIds && legacyFilter === "all") {
    const ids = allUsers.map((u) => u.id).slice(0, MAX_USERS_PER_VIEW);
    return { ownerIds: ids, presetUsed: "all" };
  }

  // 3. No param at all -> default to "mine" (when logged in).
  if (!rawOwnerIds) {
    if (sessionUserId) return { ownerIds: [sessionUserId], presetUsed: "mine" };
    return { ownerIds: [], presetUsed: "none" };
  }

  // 4. Named presets in the new param.
  if (rawOwnerIds === "mine") {
    if (sessionUserId) return { ownerIds: [sessionUserId], presetUsed: "mine" };
    return { ownerIds: [], presetUsed: "none" };
  }

  if (rawOwnerIds === "team") {
    if (!sessionUserId) return { ownerIds: [], presetUsed: "none" };
    const reportIds = allUsers
      .filter((u) => u.managerId === sessionUserId)
      .map((u) => u.id);
    const ids = Array.from(new Set([sessionUserId, ...reportIds]));
    return { ownerIds: ids, presetUsed: "team" };
  }

  if (rawOwnerIds === "all" || rawOwnerIds === "everyone") {
    const ids = allUsers.map((u) => u.id).slice(0, MAX_USERS_PER_VIEW);
    return { ownerIds: ids, presetUsed: "all" };
  }

  // 5. Comma-separated explicit list.
  const validIds = new Set(allUsers.map((u) => u.id));
  const requested = rawOwnerIds
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ids = Array.from(new Set(requested.filter((id) => validIds.has(id))));

  if (ids.length === 0) {
    return { ownerIds: [], presetUsed: "none" };
  }
  return { ownerIds: ids, presetUsed: "custom" };
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
