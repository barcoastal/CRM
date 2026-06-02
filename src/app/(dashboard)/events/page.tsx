import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { genericTone } from "@/lib/slds/status-tones";

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

export default async function EventsPage() {
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

  const columns: ListViewColumn<EventRow>[] = [
    { key: "subject", label: "Subject", render: (e) => e.subject },
    { key: "start", label: "Start", render: (e) => e.startAt.toLocaleString() },
    { key: "end", label: "End", render: (e) => e.endAt.toLocaleString() },
    { key: "loc", label: "Location", render: (e) => e.location ?? "—" },
    { key: "status", label: "Status", render: (e) => <StatusPill label={e.status} tone={genericTone(e.status)} /> },
    {
      key: "related",
      label: "Related",
      render: (e) =>
        e.account ? <Link href={`/accounts/${e.account.id}`} style={{ color: "#1589ee" }}>{e.account.name}</Link> :
        e.lead ? <Link href={`/leads/${e.lead.id}`} style={{ color: "#1589ee" }}>{e.lead.contactName}</Link> :
        e.contact ? <Link href={`/contacts/${e.contact.id}`} style={{ color: "#1589ee" }}>{e.contact.fullName}</Link> : "—",
    },
    { key: "owner", label: "Owner", render: (e) => e.owner?.name ?? "—" },
  ];

  return (
    <ListView
      entity="Event"
      entityLabel="Events"
      viewName="All Events"
      totalCount={total}
      rows={items as EventRow[]}
      columns={columns}
      rowHref={(e) => `/events/${e.id}`}
      newHref="/events/new"
    />
  );
}
