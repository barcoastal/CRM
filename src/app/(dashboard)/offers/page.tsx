import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { genericTone } from "@/lib/slds/status-tones";

type OfferRow = {
  id: string;
  direction: string;
  amountOffered: number;
  percentOffered: number;
  status: string;
  createdAt: Date;
  debt: { id: string; creditorName: string; opportunity: { id: string; account: { name: string } | null } | null };
};

export default async function OffersPage() {
  const items = await prisma.offer.findMany({
    include: {
      debt: {
        select: {
          id: true, creditorName: true,
          opportunity: { select: { id: true, account: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const total = await prisma.offer.count();
  const columns: ListViewColumn<OfferRow>[] = [
    { key: "creditor", label: "Creditor", render: (o) => o.debt.creditorName },
    { key: "account", label: "Account", render: (o) => o.debt.opportunity?.account?.name ?? "—" },
    { key: "amount", label: "Amount Offered", render: (o) => `$${o.amountOffered.toLocaleString()}` },
    { key: "pct", label: "Offer %", render: (o) => `${Math.round(o.percentOffered * 100)}%` },
    { key: "dir", label: "Direction", render: (o) => o.direction.replace(/_/g, " ") },
    { key: "status", label: "Status", render: (o) => <StatusPill label={o.status} tone={genericTone(o.status)} /> },
    { key: "date", label: "Created", render: (o) => o.createdAt.toLocaleDateString() },
  ];
  return (
    <ListView
      entity="Offer"
      entityLabel="Offers"
      viewName="All Offers"
      totalCount={total}
      rows={items as OfferRow[]}
      columns={columns}
      rowHref={(o) => `/offers/${o.id}`}
    />
  );
}
