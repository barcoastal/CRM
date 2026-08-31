import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ListView, type ListViewColumn } from "@/components/slds/list-view";
import { StatusPill } from "@/components/slds/record-page";

type IntegrationRow = {
  id: string;
  provider: string;
  name: string;
  isActive: boolean;
  scopes: string | null;
  rotatedAt: Date | null;
  createdAt: Date;
  createdBy: { id: string; name: string } | null;
};

export default async function IntegrationsPage() {
  const items = await prisma.integrationCredential.findMany({
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: [{ provider: "asc" }, { name: "asc" }],
  });
  const total = items.length;
  const columns: ListViewColumn<IntegrationRow>[] = [
    { key: "provider", label: "Provider", render: (i) => i.provider },
    { key: "name", label: "Name", render: (i) => i.name },
    {
      key: "active",
      label: "Active",
      render: (i) => <StatusPill label={i.isActive ? "Active" : "Inactive"} tone={i.isActive ? "success" : "neutral"} />,
    },
    { key: "rotated", label: "Last Rotated", render: (i) => i.rotatedAt?.toLocaleDateString() ?? "—" },
    { key: "by", label: "Created By", render: (i) => i.createdBy?.name ?? "—" },
  ];
  return (
    <>
      <div style={{ padding: "10px 16px 0", fontSize: 13 }}>
        <Link
          href="/api/integrations/google-calendar/connect"
          prefetch={false}
          style={{ color: "#0176d3", marginRight: 20 }}
        >
          Connect Google Calendar →
        </Link>
        <Link href="/integrations/processor-log" style={{ color: "#0176d3" }}>
          Processor Sync Journal (SAS/RAM outbound payloads) →
        </Link>
      </div>
      <ListView
        entity="Settings"
        entityLabel="Integration"
        viewName="All Integrations"
        totalCount={total}
        rows={items as IntegrationRow[]}
        columns={columns}
      />
    </>
  );
}
