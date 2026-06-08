import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Plus, Eye, Pencil, MoreHorizontal } from "@/components/icons/lucide";

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

export default async function CampaignsPage() {
  await auth();

  const campaigns = await prisma.campaign.findMany({
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
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-[24px] font-bold tracking-tight text-[#131b2e]"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Campaigns
        </h1>
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold shadow-[0_8px_24px_rgba(48,82,255,0.25)]"
          style={{
            background: "linear-gradient(135deg, #0034e4, #3052ff)",
          }}
        >
          <Plus className="size-4" />
          New Campaign
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2.5">
        <select
          className="px-3.5 py-2 rounded bg-white text-[13px] text-[#444656] font-medium cursor-pointer pr-8 shadow-[0_12px_40px_rgba(19,27,46,0.06)] border-none outline-none appearance-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23444656' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
          }}
        >
          <option>All Statuses</option>
          <option>Active</option>
          <option>Draft</option>
          <option>Paused</option>
          <option>Completed</option>
        </select>
        <select
          className="px-3.5 py-2 rounded bg-white text-[13px] text-[#444656] font-medium cursor-pointer pr-8 shadow-[0_12px_40px_rgba(19,27,46,0.06)] border-none outline-none appearance-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23444656' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
          }}
        >
          <option>All Dialer Modes</option>
          <option>Power</option>
          <option>Preview</option>
          <option>Predictive</option>
        </select>
      </div>

      {/* Table Card */}
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {[
                "Campaign Name",
                "Status",
                "Dialer Mode",
                "Total Contacts",
                "Dialed",
                "Connected",
                "Conn. Rate",
                "Enrolled",
                "Start Date",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] px-4 py-3.5 bg-[#f2f3ff]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaignsWithStats.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="h-24 text-center text-[13px] text-[#444656] py-8 bg-white"
                >
                  No campaigns yet. Create your first campaign to get started.
                </td>
              </tr>
            ) : (
              campaignsWithStats.map((campaign, idx) => {
                const statusStyle =
                  STATUS_STYLES[campaign.status] || STATUS_STYLES.DRAFT;
                const rateColor = getConnectionRateColor(
                  campaign.connectedPercent
                );
                const rowBg = idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]";
                const startDate = campaign.createdAt
                  ? new Date(campaign.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "--";

                return (
                  <tr key={campaign.id}>
                    <td className={`px-4 py-3.5 text-[13px] ${rowBg}`}>
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="font-semibold text-[#131b2e] hover:text-[#3052ff] transition-colors"
                      >
                        {campaign.name}
                      </Link>
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] ${rowBg}`}>
                      <span
                        className={`inline-block px-3 py-1 rounded text-[11px] font-semibold uppercase tracking-[0.3px] ${statusStyle.bg} ${statusStyle.text}`}
                      >
                        {statusStyle.label}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3.5 text-[13px] text-[#131b2e] ${rowBg}`}
                    >
                      {campaign.dialerMode.charAt(0) +
                        campaign.dialerMode.slice(1).toLowerCase()}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-[13px] text-[#131b2e] ${rowBg}`}
                    >
                      {campaign._count.contacts}
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] ${rowBg}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-[60px] h-[6px] bg-[#eaedff] rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${campaign.dialedPercent}%`,
                              background:
                                "linear-gradient(135deg, #0034e4, #3052ff)",
                            }}
                          />
                        </div>
                        <span className="text-[12px] text-[#444656] font-medium">
                          {campaign.dialed}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`px-4 py-3.5 text-[13px] text-[#131b2e] ${rowBg}`}
                    >
                      {campaign.connected}
                    </td>
                    <td className={`px-4 py-3.5 text-[13px] ${rowBg}`}>
                      {campaign.dialed > 0 ? (
                        <span className={`font-semibold ${rateColor}`}>
                          {campaign.connectedPercent}%
                        </span>
                      ) : (
                        <span className="text-[#444656]">--</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-[13px] text-[#131b2e] ${rowBg}`}
                    >
                      {campaign.enrolled}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-[13px] text-[#444656] ${rowBg}`}
                    >
                      {startDate}
                    </td>
                    <td className={`px-4 py-3.5 ${rowBg}`}>
                      <div className="flex gap-1">
                        <Link
                          href={`/campaigns/${campaign.id}`}
                          title="View"
                          className="w-[30px] h-[30px] rounded flex items-center justify-center bg-[#f2f3ff] text-[#444656] hover:bg-[#3052ff] hover:text-white transition-colors"
                        >
                          <Eye className="size-[14px]" />
                        </Link>
                        <Link
                          href={`/campaigns/${campaign.id}?tab=settings`}
                          title="Edit"
                          className="w-[30px] h-[30px] rounded flex items-center justify-center bg-[#f2f3ff] text-[#444656] hover:bg-[#3052ff] hover:text-white transition-colors"
                        >
                          <Pencil className="size-[14px]" />
                        </Link>
                        <button
                          title="More"
                          className="w-[30px] h-[30px] rounded flex items-center justify-center bg-[#f2f3ff] text-[#444656] hover:bg-[#3052ff] hover:text-white transition-colors"
                        >
                          <MoreHorizontal className="size-[14px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
