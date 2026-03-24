"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddLeadsDialog } from "@/components/campaigns/add-leads-dialog";
import { DIALER_MODES } from "@/lib/validations/campaign";
import { Phone, Pause, Play, Plus, UserMinus } from "lucide-react";

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

const CONTACT_STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  PENDING: { bg: "bg-[#f2f3ff]", text: "text-[#444656]", label: "Pending" },
  IN_PROGRESS: {
    bg: "bg-[rgba(48,82,255,0.1)]",
    text: "text-[#3052ff]",
    label: "Dialed",
  },
  COMPLETED: {
    bg: "bg-[rgba(26,125,55,0.1)]",
    text: "text-[#1a7d37]",
    label: "Connected",
  },
  SKIPPED: {
    bg: "bg-[rgba(180,140,0,0.1)]",
    text: "text-[#8a6d00]",
    label: "Skipped",
  },
  MAX_ATTEMPTS: {
    bg: "bg-[rgba(148,43,0,0.08)]",
    text: "text-[#942b00]",
    label: "Max Attempts",
  },
};

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

interface Lead {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string | null;
  status: string;
}

interface CampaignContact {
  id: string;
  leadId: string;
  lead: Lead;
  status: string;
  priority: number;
  attempts: number;
  lastAttempt: string | null;
}

interface Agent {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar: string | null;
  };
}

interface CampaignStats {
  totalContacts: number;
  dialed: number;
  connected: number;
  enrolled: number;
  remaining: number;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  dialerMode: string;
  status: string;
  script: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  contacts: CampaignContact[];
  agents: Agent[];
  stats: CampaignStats;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatLastAttempt(iso: string | null) {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CampaignDetailClient({
  campaign: initialCampaign,
}: {
  campaign: Campaign;
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [activeTab, setActiveTab] = useState("contacts");
  const [addLeadsOpen, setAddLeadsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  async function refreshCampaign() {
    const res = await fetch(`/api/campaigns/${campaign.id}`);
    if (res.ok) {
      const data = await res.json();
      setCampaign(data);
    }
    router.refresh();
  }

  async function toggleStatus() {
    setTogglingStatus(true);
    const newStatus = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await refreshCampaign();
      }
    } finally {
      setTogglingStatus(false);
    }
  }

  async function removeAgent(userId: string) {
    const res = await fetch(`/api/campaigns/${campaign.id}/agents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [userId] }),
    });
    if (res.ok) {
      await refreshCampaign();
    }
  }

  async function handleSettingsSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || undefined,
      dialerMode: formData.get("dialerMode") as string,
      script: (formData.get("script") as string) || undefined,
      startTime: (formData.get("startTime") as string) || undefined,
      endTime: (formData.get("endTime") as string) || undefined,
      timezone: formData.get("timezone") as string,
    };

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await refreshCampaign();
      }
    } finally {
      setSaving(false);
    }
  }

  const existingLeadIds = campaign.contacts.map((c) => c.leadId);
  const statusStyle = STATUS_STYLES[campaign.status] || STATUS_STYLES.DRAFT;

  const dialedPct =
    campaign.stats.totalContacts > 0
      ? Math.round((campaign.stats.dialed / campaign.stats.totalContacts) * 100)
      : 0;
  const connectedPct =
    campaign.stats.dialed > 0
      ? Math.round(
          (campaign.stats.connected / campaign.stats.dialed) * 100
        )
      : 0;
  const enrolledPct =
    campaign.stats.connected > 0
      ? Math.round(
          (campaign.stats.enrolled / campaign.stats.connected) * 100
        )
      : 0;

  const tabs = ["contacts", "agents", "script", "settings"];
  const tabLabels: Record<string, string> = {
    contacts: "Contacts",
    agents: "Agents",
    script: "Script",
    settings: "Settings",
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[#444656]">
        <Link
          href="/campaigns"
          className="text-[#3052ff] font-medium hover:underline"
        >
          Campaigns
        </Link>
        <span className="text-[#c4c5d9]">›</span>
        <span>{campaign.name}</span>
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1
            className="text-[24px] font-bold text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {campaign.name}
          </h1>
          <span
            className={`inline-block px-3 py-1 rounded text-[11px] font-semibold uppercase tracking-[0.3px] ${statusStyle.bg} ${statusStyle.text}`}
          >
            {statusStyle.label}
          </span>
          <span className="inline-block px-3 py-1 rounded text-[11px] font-semibold bg-[#f2f3ff] text-[#444656] uppercase tracking-[0.3px]">
            {campaign.dialerMode}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dialer?campaignId=${campaign.id}`}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded text-white text-[13px] font-semibold shadow-[0_8px_24px_rgba(48,82,255,0.25)]"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            <Phone className="size-4" />
            Launch Dialer
          </Link>
          {campaign.status !== "COMPLETED" && (
            <button
              onClick={toggleStatus}
              disabled={togglingStatus}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded bg-white text-[#444656] text-[13px] font-semibold hover:text-[#131b2e] transition-colors disabled:opacity-50"
              style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              {campaign.status === "ACTIVE" ? (
                <>
                  <Pause className="size-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  Resume
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab("settings")}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded bg-white text-[#444656] text-[13px] font-semibold hover:text-[#131b2e] transition-colors"
            style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            Edit
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-3.5">
        {/* Total Contacts */}
        <div
          className="bg-white rounded-xl px-5 py-[18px] relative overflow-hidden"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#3052ff] rounded-r" />
          <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-1.5">
            Total Contacts
          </div>
          <div
            className="text-[24px] font-extrabold text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {campaign.stats.totalContacts}
          </div>
          <div className="text-[12px] text-[#444656] mt-1 font-medium">
            Full list loaded
          </div>
        </div>

        {/* Dialed */}
        <div
          className="bg-white rounded-xl px-5 py-[18px] relative overflow-hidden"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#3052ff] rounded-r" />
          <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-1.5">
            Dialed
          </div>
          <div
            className="text-[24px] font-extrabold text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {campaign.stats.dialed}
          </div>
          <div className="text-[12px] text-[#444656] mt-1 font-medium">
            <strong className="text-[#0034e4]">{dialedPct}%</strong> of total
          </div>
          <div className="h-1 bg-[#eaedff] rounded mt-2 overflow-hidden">
            <div
              className="h-full rounded"
              style={{
                width: `${dialedPct}%`,
                background: "linear-gradient(135deg, #0034e4, #3052ff)",
              }}
            />
          </div>
        </div>

        {/* Connected */}
        <div
          className="bg-white rounded-xl px-5 py-[18px] relative overflow-hidden"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#3052ff] rounded-r" />
          <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-1.5">
            Connected
          </div>
          <div
            className="text-[24px] font-extrabold text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {campaign.stats.connected}
          </div>
          <div className="text-[12px] text-[#444656] mt-1 font-medium">
            <strong className="text-[#0034e4]">{connectedPct}%</strong> of
            dialed
          </div>
          <div className="h-1 bg-[#eaedff] rounded mt-2 overflow-hidden">
            <div
              className="h-full rounded"
              style={{
                width: `${connectedPct}%`,
                background: "linear-gradient(135deg, #0034e4, #3052ff)",
              }}
            />
          </div>
        </div>

        {/* Enrolled */}
        <div
          className="bg-white rounded-xl px-5 py-[18px] relative overflow-hidden"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#3052ff] rounded-r" />
          <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-1.5">
            Enrolled
          </div>
          <div
            className="text-[24px] font-extrabold text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {campaign.stats.enrolled}
          </div>
          <div className="text-[12px] text-[#444656] mt-1 font-medium">
            <strong className="text-[#0034e4]">{enrolledPct}%</strong> of
            connected
          </div>
          <div className="h-1 bg-[#eaedff] rounded mt-2 overflow-hidden">
            <div
              className="h-full rounded"
              style={{
                width: `${enrolledPct}%`,
                background: "linear-gradient(135deg, #0034e4, #3052ff)",
              }}
            />
          </div>
        </div>

        {/* Remaining */}
        <div
          className="bg-white rounded-xl px-5 py-[18px] relative overflow-hidden"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#3052ff] rounded-r" />
          <div className="text-[11px] font-semibold text-[#444656] uppercase tracking-[0.5px] mb-1.5">
            Remaining
          </div>
          <div
            className="text-[24px] font-extrabold text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {campaign.stats.remaining}
          </div>
          <div className="text-[12px] text-[#444656] mt-1 font-medium">
            Contacts pending
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-7 py-3.5 text-[13px] font-semibold transition-all relative ${
              activeTab === tab
                ? "text-[#0034e4] bg-[#f2f3ff]"
                : "text-[#444656] hover:text-[#131b2e] hover:bg-[#faf8ff]"
            }`}
          >
            {tabLabels[tab]}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3052ff]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab: Contacts */}
      {activeTab === "contacts" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-[16px] font-bold text-[#131b2e]"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Campaign Contacts
            </h3>
            <button
              onClick={() => setAddLeadsOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13px] font-semibold shadow-[0_8px_24px_rgba(48,82,255,0.25)]"
              style={{
                background: "linear-gradient(135deg, #0034e4, #3052ff)",
              }}
            >
              <Plus className="size-4" />
              Add Leads
            </button>
          </div>

          <div
            className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {[
                    "Contact Name",
                    "Phone",
                    "Status",
                    "Last Attempt",
                    "Disposition",
                    "Attempts",
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
                {campaign.contacts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="h-24 text-center text-[13px] text-[#444656] py-8 bg-white"
                    >
                      No contacts in this campaign. Click &quot;Add Leads&quot;
                      to add some.
                    </td>
                  </tr>
                ) : (
                  campaign.contacts.map((contact, idx) => {
                    const cStatus =
                      CONTACT_STATUS_STYLES[contact.status] ||
                      CONTACT_STATUS_STYLES.PENDING;
                    const rowBg =
                      idx % 2 === 0 ? "bg-white" : "bg-[#faf8ff]";
                    return (
                      <tr key={contact.id}>
                        <td
                          className={`px-4 py-3.5 text-[13px] font-semibold text-[#131b2e] ${rowBg}`}
                        >
                          {contact.lead.contactName}
                        </td>
                        <td
                          className={`px-4 py-3.5 text-[13px] text-[#131b2e] ${rowBg}`}
                        >
                          {contact.lead.phone}
                        </td>
                        <td className={`px-4 py-3.5 text-[13px] ${rowBg}`}>
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold ${cStatus.bg} ${cStatus.text}`}
                          >
                            {cStatus.label}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3.5 text-[13px] text-[#444656] ${rowBg}`}
                        >
                          {formatLastAttempt(contact.lastAttempt)}
                        </td>
                        <td
                          className={`px-4 py-3.5 text-[13px] text-[#444656] ${rowBg}`}
                        >
                          {contact.lead.status || "--"}
                        </td>
                        <td
                          className={`px-4 py-3.5 text-[13px] ${rowBg}`}
                        >
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#f2f3ff] text-[11px] font-bold text-[#444656]">
                            {contact.attempts}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Agents */}
      {activeTab === "agents" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-[16px] font-bold text-[#131b2e]"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Agent Assignments
            </h3>
            <AddAgentButton
              campaignId={campaign.id}
              onAdded={refreshCampaign}
            />
          </div>

          {campaign.agents.length === 0 ? (
            <div
              className="bg-white rounded-xl py-10 text-center text-[13px] text-[#444656]"
              style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              No agents assigned to this campaign yet.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3.5">
              {campaign.agents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-white rounded-xl p-5 flex flex-col items-center text-center relative overflow-hidden"
                  style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#3052ff] rounded-r" />
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[16px] font-bold mb-2.5"
                    style={{
                      background:
                        "linear-gradient(135deg, #0034e4, #3052ff)",
                    }}
                  >
                    {getInitials(agent.user.name)}
                  </div>
                  <div
                    className="text-[14px] font-bold text-[#131b2e] mb-2"
                    style={{ fontFamily: "Manrope, sans-serif" }}
                  >
                    {agent.user.name}
                  </div>
                  <div className="text-[12px] text-[#444656] mb-3">
                    {agent.user.email}
                  </div>
                  <button
                    onClick={() => removeAgent(agent.userId)}
                    title="Remove agent"
                    className="inline-flex items-center gap-1 text-[11px] text-[#942b00] font-medium hover:opacity-80 transition-opacity"
                  >
                    <UserMinus className="size-3" />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Script */}
      {activeTab === "script" && (
        <div
          className="bg-white rounded-xl p-6"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <h3
            className="text-[16px] font-bold text-[#131b2e] mb-4"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Call Script
          </h3>
          {campaign.script ? (
            <div className="whitespace-pre-wrap rounded bg-[#f2f3ff] p-4 text-[13.5px] text-[#131b2e] leading-relaxed">
              {campaign.script}
            </div>
          ) : (
            <p className="text-[13px] text-[#444656]">
              No script has been added for this campaign. Go to the Settings tab
              to add one.
            </p>
          )}
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === "settings" && (
        <div
          className="bg-white rounded-xl p-6 max-w-2xl"
          style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <h3
            className="text-[16px] font-bold text-[#131b2e] mb-5"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Campaign Settings
          </h3>
          <form onSubmit={handleSettingsSave} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="settings-name"
                className="text-[12.5px] font-semibold text-[#444656]"
              >
                Campaign Name
              </Label>
              <Input
                id="settings-name"
                name="name"
                defaultValue={campaign.name}
                required
                className="bg-[#f2f3ff] border-none focus-visible:ring-1 focus-visible:ring-[#3052ff]"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="settings-description"
                className="text-[12.5px] font-semibold text-[#444656]"
              >
                Description
              </Label>
              <Textarea
                id="settings-description"
                name="description"
                defaultValue={campaign.description || ""}
                rows={3}
                className="bg-[#f2f3ff] border-none focus-visible:ring-1 focus-visible:ring-[#3052ff]"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="settings-dialerMode"
                className="text-[12.5px] font-semibold text-[#444656]"
              >
                Dialer Mode
              </Label>
              <Select name="dialerMode" defaultValue={campaign.dialerMode}>
                <SelectTrigger className="w-full bg-[#f2f3ff] border-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIALER_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="settings-script"
                className="text-[12.5px] font-semibold text-[#444656]"
              >
                Call Script
              </Label>
              <Textarea
                id="settings-script"
                name="script"
                defaultValue={campaign.script || ""}
                rows={6}
                className="bg-[#f2f3ff] border-none focus-visible:ring-1 focus-visible:ring-[#3052ff]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="settings-startTime"
                  className="text-[12.5px] font-semibold text-[#444656]"
                >
                  Start Time
                </Label>
                <Input
                  id="settings-startTime"
                  name="startTime"
                  type="time"
                  defaultValue={campaign.startTime || ""}
                  className="bg-[#f2f3ff] border-none focus-visible:ring-1 focus-visible:ring-[#3052ff]"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="settings-endTime"
                  className="text-[12.5px] font-semibold text-[#444656]"
                >
                  End Time
                </Label>
                <Input
                  id="settings-endTime"
                  name="endTime"
                  type="time"
                  defaultValue={campaign.endTime || ""}
                  className="bg-[#f2f3ff] border-none focus-visible:ring-1 focus-visible:ring-[#3052ff]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="settings-timezone"
                className="text-[12.5px] font-semibold text-[#444656]"
              >
                Timezone
              </Label>
              <Select name="timezone" defaultValue={campaign.timezone}>
                <SelectTrigger className="w-full bg-[#f2f3ff] border-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-5 py-2.5 rounded text-white text-[13px] font-semibold shadow-[0_8px_24px_rgba(48,82,255,0.25)] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </form>
        </div>
      )}

      {/* Add Leads Dialog */}
      <AddLeadsDialog
        campaignId={campaign.id}
        existingLeadIds={existingLeadIds}
        open={addLeadsOpen}
        onOpenChange={setAddLeadsOpen}
        onLeadsAdded={refreshCampaign}
      />
    </div>
  );
}

// Inline AddAgent button component
function AddAgentButton({
  campaignId,
  onAdded,
}: {
  campaignId: string;
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [users, setUsers] = useState<
    { id: string; name: string; email: string; role: string }[]
  >([]);
  const [showDropdown, setShowDropdown] = useState(false);

  async function loadUsers() {
    setShowDropdown(true);
    try {
      const res = await fetch("/api/users?role=SALES_REP&limit=50");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || data || []);
      }
    } catch {
      // Silently handle error
    }
  }

  async function addAgent(userId: string) {
    setAdding(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [userId] }),
      });
      if (res.ok) {
        onAdded();
        setShowDropdown(false);
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={loadUsers}
        disabled={adding}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-white text-[13px] font-semibold shadow-[0_8px_24px_rgba(48,82,255,0.25)] disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
      >
        <Plus className="size-4" />
        Add Agent
      </button>
      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl bg-white p-2 shadow-[0_12px_40px_rgba(19,27,46,0.12)]">
            {users.length === 0 ? (
              <div className="py-4 text-center text-[13px] text-[#444656]">
                No available users found
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => addAgent(user.id)}
                    disabled={adding}
                    className="w-full flex items-center gap-2 rounded px-2 py-2 text-left text-[13px] hover:bg-[#f2f3ff] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[#131b2e] truncate">
                        {user.name}
                      </div>
                      <div className="text-[11px] text-[#444656] truncate">
                        {user.email}
                      </div>
                    </div>
                    <span className="text-[11px] text-[#444656] shrink-0">
                      {user.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
