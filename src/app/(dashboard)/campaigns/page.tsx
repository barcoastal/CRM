import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ListView } from "@/components/slds/list-view";
import styles from "@/components/slds/lightning-list.module.css";

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  DRAFT: { bg: "bg-[#f2f3ff]", text: "text-[#444656]", label: "Draft" },
  ACTIVE: {
    bg: "bg-[rgba(26,125,55,0.1)]",
    text: "text-[#1a7d37]",
    label: "Active",
  },
  PAUSED: {
    bg: "bg-[rgba(180,140,0,0.1)]",
    text: "text-[#8a6d00]",
    label: "Paused",
  },
  COMPLETED: {
    bg: "bg-[rgba(48,82,255,0.1)]",
    text: "text-[#3052ff]",
    label: "Completed",
  },
};

function getConnectionRateColor(rate: number) {
  if (rate >= 45) return "text-[#1a7d37]";
  if (rate >= 35) return "text-[#8a6d00]";
  return "text-[#942b00]";
}

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ status?: string; mode?: string }> }) {
  const params = await searchParams;
  const status = Object.hasOwn(STATUS_STYLES, params.status ?? "") ? params.status : undefined;
  const mode = ["POWER", "PREVIEW", "PREDICTIVE", "MANUAL", "AI"].includes(params.mode ?? "") ? params.mode : undefined;
  await auth();

  const campaigns = await prisma.campaign.findMany({
    where: { ...(status ? { status } : {}), ...(mode ? { dialerMode: mode } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          contacts: true,
          agents: true,
        },
      },
      contacts: {
        select: {
          status: true,
        },
      },
    },
  });

  const campaignsWithStats = campaigns.map((campaign) => {
    const dialed = campaign.contacts.filter(
      (c) => c.status !== "PENDING"
    ).length;
    const connected = campaign.contacts.filter(
      (c) => c.status === "COMPLETED"
    ).length;
    const enrolled = campaign.contacts.filter(
      (c) => c.status === "COMPLETED"
    ).length;
    const connectedPercent =
      dialed > 0 ? Math.round((connected / dialed) * 100) : 0;
    const totalContacts = campaign._count.contacts;
    const dialedPercent =
      totalContacts > 0 ? Math.round((dialed / totalContacts) * 100) : 0;

    return {
      ...campaign,
      dialed,
      connected,
      enrolled,
      connectedPercent,
      dialedPercent,
    };
  });

  return (
    <ListView entity="Campaign" entityLabel="Campaigns" viewName="All Campaigns"
      totalCount={campaignsWithStats.length} rows={campaignsWithStats}
      rowHref={c => `/campaigns/${c.id}`} newHref="/campaigns/new"
      toolbar={<form action="/campaigns" className={styles.searchForm}>
        <select name="status" aria-label="Campaign status" defaultValue={status ?? ""}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_STYLES).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
        </select>
        <select name="mode" aria-label="Dialer mode" defaultValue={mode ?? ""}>
          <option value="">All Dialer Modes</option>
          {["POWER", "PREVIEW", "PREDICTIVE", "MANUAL", "AI"].map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <button type="submit">Apply</button>
      </form>}
      columns={[
        {key: "name", label: "Campaign Name", width: 240, render: c => c.name},
        {key: "status", label: "Status", width: 110, render: c => STATUS_STYLES[c.status]?.label ?? c.status},
        {key: "mode", label: "Dialer Mode", width: 130, render: c => c.dialerMode},
        {key: "contacts", label: "Total Contacts", width: 130, render: c => c._count.contacts},
        {key: "dialed", label: "Dialed", width: 90, render: c => c.dialed},
        {key: "connected", label: "Connected", width: 100, render: c => c.connected},
        {key: "rate", label: "Connection Rate", width: 140, render: c => c.dialed > 0 ? <span className={getConnectionRateColor(c.connectedPercent)}>{c.connectedPercent}%</span> : "—"},
        {key: "enrolled", label: "Enrolled", width: 90, render: c => c.enrolled},
        {key: "start", label: "Start Date", width: 140, render: c => c.createdAt.toLocaleDateString("en-US")},
        {key: "actions", label: "Actions", width: 130, render: c => <span className="inline-flex gap-3"><Link href={`/campaigns/${c.id}`}>View</Link><Link href={`/campaigns/${c.id}?tab=settings`}>Edit</Link></span>},
      ]}
    />
  );
}
