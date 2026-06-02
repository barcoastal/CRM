import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { genericTone } from "@/lib/slds/status-tones";

type EmailRow = {
  id: string;
  direction: string;
  status: string;
  subject: string;
  fromAddress: string;
  toAddresses: string;
  sentAt: Date | null;
  account: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
};

export default async function EmailsPage() {
  const items = await prisma.emailMessage.findMany({
    include: {
      account: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const total = await prisma.emailMessage.count();
  const columns: ListViewColumn<EmailRow>[] = [
    { key: "subject", label: "Subject", render: (m) => m.subject },
    { key: "dir", label: "Direction", render: (m) => m.direction },
    { key: "status", label: "Status", render: (m) => <StatusPill label={m.status} tone={genericTone(m.status)} /> },
    { key: "to", label: "To", render: (m) => m.toAddresses },
    {
      key: "account",
      label: "Account",
      render: (m) => m.account ? <Link href={`/accounts/${m.account.id}`} style={{ color: "#1589ee" }}>{m.account.name}</Link> : "—",
    },
    { key: "sent", label: "Sent", render: (m) => m.sentAt?.toLocaleString() ?? "—" },
    { key: "owner", label: "Owner", render: (m) => m.owner?.name ?? "—" },
  ];
  return (
    <ListView
      entity="Email"
      entityLabel="Emails"
      viewName="Recent Emails"
      totalCount={total}
      rows={items as EmailRow[]}
      columns={columns}
      rowHref={(m) => `/emails/${m.id}`}
      newHref="/emails/new"
    />
  );
}
