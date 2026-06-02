import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";
import { genericTone } from "@/lib/slds/status-tones";

type SmsRow = {
  id: string;
  direction: string;
  status: string;
  body: string;
  fromNumber: string;
  toNumber: string;
  sentAt: Date | null;
  account: { id: string; name: string } | null;
};

export default async function SmsPage() {
  const items = await prisma.smsMessage.findMany({
    include: { account: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const total = await prisma.smsMessage.count();
  const columns: ListViewColumn<SmsRow>[] = [
    { key: "body", label: "Message", render: (m) => m.body.length > 60 ? `${m.body.slice(0, 60)}…` : m.body },
    { key: "dir", label: "Direction", render: (m) => m.direction },
    { key: "from", label: "From", render: (m) => m.fromNumber },
    { key: "to", label: "To", render: (m) => m.toNumber },
    { key: "status", label: "Status", render: (m) => <StatusPill label={m.status} tone={genericTone(m.status)} /> },
    {
      key: "account",
      label: "Account",
      render: (m) => m.account ? <Link href={`/accounts/${m.account.id}`} style={{ color: "#1589ee" }}>{m.account.name}</Link> : "—",
    },
    { key: "sent", label: "Sent", render: (m) => m.sentAt?.toLocaleString() ?? "—" },
  ];
  return (
    <ListView
      entity="Sms"
      entityLabel="SMS"
      viewName="Recent SMS"
      totalCount={total}
      rows={items as SmsRow[]}
      columns={columns}
    />
  );
}
