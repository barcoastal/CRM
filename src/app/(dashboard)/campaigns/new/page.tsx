"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DIALER_MODES } from "@/lib/validations/campaign";
import { Zap, Users, Eye, Search } from "@/components/icons/lucide";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const TIMEZONE_LABELS: Record<string, string> = {
  "America/New_York": "Eastern Time (ET) — UTC-5",
  "America/Chicago": "Central Time (CT) — UTC-6",
  "America/Denver": "Mountain Time (MT) — UTC-7",
  "America/Los_Angeles": "Pacific Time (PT) — UTC-8",
  "America/Phoenix": "Arizona Time (AZ) — UTC-7",
  "America/Anchorage": "Alaska Time (AK) — UTC-9",
  "Pacific/Honolulu": "Hawaii Time (HI) — UTC-10",
};

const DIALER_INFO: Record<
  string,
  { label: string; description: string; icon: React.ReactNode }
> = {
  POWER: {
    label: "Power Dialer",
    description:
      "Auto-dial next contact when call ends. Best for high-volume campaigns with simple scripts.",
    icon: <Zap className="size-[18px] text-[#3052ff]" />,
  },
  PREDICTIVE: {
    label: "Predictive Dialer",
    description:
      "Dial multiple contacts simultaneously. Optimizes agent utilization with call routing algorithms.",
    icon: <Users className="size-[18px] text-[#3052ff]" />,
  },
  PREVIEW: {
    label: "Preview Dialer",
    description:
      "Review contact details before dialing. Ideal for complex accounts requiring preparation.",
    icon: <Eye className="size-[18px] text-[#3052ff]" />,
  },
  AI: {
    label: "AI Voice Qualifier",
    description: "Call consented leads, qualify them, book Google Calendar meetings, and warm-transfer qualified answers.",
    icon: <Zap className="size-[18px] text-[#3052ff]" />,
  },
};

const inputClass =
  "w-full px-3.5 py-2.5 rounded bg-[#f2f3ff] border-none text-[13.5px] text-[#131b2e] outline-none focus:ring-1 focus:ring-[#3052ff] placeholder-[#444656] font-[Inter,sans-serif]";
const labelClass =
  "block text-[12.5px] font-semibold text-[#444656] mb-1.5";

export default function NewCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMode, setSelectedMode] = useState<string>("POWER");

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
    launch = false
  ) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || undefined,
      dialerMode: selectedMode,
      script: (formData.get("script") as string) || undefined,
      startTime: (formData.get("startTime") as string) || undefined,
      endTime: (formData.get("endTime") as string) || undefined,
      timezone: formData.get("timezone") as string,
      aiEnabled: selectedMode === "AI",
      aiAgentId: selectedMode === "AI" ? (formData.get("aiAgentId") as string) : undefined,
      aiMaxConcurrency: selectedMode === "AI" ? Number(formData.get("aiMaxConcurrency") || 10) : 10,
      meetingDurationMin: selectedMode === "AI" ? Number(formData.get("meetingDurationMin") || 30) : 30,
      status: launch ? "ACTIVE" : "DRAFT",
    };

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const result = await res.json();
        setError(result.error || "Failed to create campaign");
        return;
      }

      const campaign = await res.json();
      router.push(`/campaigns/${campaign.id}`);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center gap-2 text-[13px] text-[#444656] mb-2">
            <Link
              href="/campaigns"
              className="text-[#3052ff] font-medium hover:underline"
            >
              Campaigns
            </Link>
            <span className="text-[#c4c5d9]">›</span>
            <span>New Campaign</span>
          </nav>
          <h1
            className="text-[24px] font-bold text-[#131b2e]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Create New Campaign
          </h1>
        </div>
        <div className="flex gap-2.5">
          <button
            form="campaign-form"
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded bg-white text-[#131b2e] text-[13.5px] font-medium cursor-pointer hover:text-[#3052ff] transition-colors disabled:opacity-50"
            style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
          >
            Save Draft
          </button>
          <button
            disabled={loading}
            onClick={() => {
              const form = document.getElementById(
                "campaign-form"
              ) as HTMLFormElement;
              if (form) {
                const syntheticEvent = new Event("submit", {
                  bubbles: true,
                  cancelable: true,
                });
                form.dispatchEvent(syntheticEvent);
              }
            }}
            className="px-6 py-2.5 rounded text-white text-[13.5px] font-semibold shadow-[0_4px_16px_rgba(48,82,255,0.3)] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
          >
            {loading ? "Creating..." : "Launch Campaign"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Two-panel layout */}
      <form id="campaign-form" onSubmit={handleSubmit}>
        <div className="grid gap-6" style={{ gridTemplateColumns: "65% 1fr" }}>
          {/* Left: Form */}
          <div className="space-y-5">
            {/* Campaign Details */}
            <div
              className="bg-white rounded-xl p-6"
              style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              <h2
                className="text-[16px] font-bold text-[#131b2e] mb-[18px]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Campaign Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className={labelClass}>
                    Campaign Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="e.g., Q2 Credit Card Outreach"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="description" className={labelClass}>
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    placeholder="Describe the campaign goals, target audience, and expected outcomes..."
                    rows={3}
                    className={`${inputClass} resize-vertical min-h-[80px]`}
                  />
                </div>
              </div>
            </div>

            {/* Dialer Settings */}
            <div
              className="bg-white rounded-xl p-6"
              style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              <h2
                className="text-[16px] font-bold text-[#131b2e] mb-[18px]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Dialer Settings
              </h2>
              <div className="flex flex-col gap-2.5">
                {DIALER_MODES.map((mode) => {
                  const info = DIALER_INFO[mode] || {
                    label: mode,
                    description: "",
                    icon: null,
                  };
                  const selected = selectedMode === mode;
                  return (
                    <label
                      key={mode}
                      className={`flex items-start gap-3.5 px-[18px] py-4 rounded-lg cursor-pointer transition-all ${
                        selected
                          ? "bg-[#eaedff] ring-2 ring-[#3052ff]"
                          : "bg-[#f2f3ff] hover:bg-[#eaedff]"
                      }`}
                      onClick={() => setSelectedMode(mode)}
                    >
                      <input
                        type="radio"
                        name="dialerMode"
                        value={mode}
                        checked={selected}
                        onChange={() => setSelectedMode(mode)}
                        className="hidden"
                      />
                      {/* Radio dot */}
                      <div
                        className={`w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          selected
                            ? "ring-2 ring-[#3052ff]"
                            : "ring-2 ring-[#c4c5d9]"
                        }`}
                      >
                        {selected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#3052ff]" />
                        )}
                      </div>
                      {/* Icon */}
                      <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                        {info.icon}
                      </div>
                      {/* Text */}
                      <div>
                        <div className="text-[14px] font-semibold text-[#131b2e] mb-0.5">
                          {info.label}
                        </div>
                        <div className="text-[12.5px] text-[#444656] leading-relaxed">
                          {info.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {selectedMode === "AI" && (
              <div className="bg-white rounded-xl p-6" style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}>
                <h2 className="text-[16px] font-bold text-[#131b2e] mb-[18px]" style={{ fontFamily: "Manrope, sans-serif" }}>
                  AI Voice Settings
                </h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="aiAgentId" className={labelClass}>Published Retell Agent ID</label>
                    <input id="aiAgentId" name="aiAgentId" required placeholder="agent_..." className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="aiMaxConcurrency" className={labelClass}>Concurrent Calls</label>
                      <input id="aiMaxConcurrency" name="aiMaxConcurrency" type="number" min="1" max="100" defaultValue="10" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="meetingDurationMin" className={labelClass}>Meeting Minutes</label>
                      <input id="meetingDurationMin" name="meetingDurationMin" type="number" min="15" max="120" defaultValue="30" className={inputClass} />
                    </div>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-[#8a6d00] bg-[#fff8dd] rounded-lg p-3">
                    AI dialing is blocked unless every lead has stored automated-call consent and passes DNC and local-time checks.
                  </p>
                </div>
              </div>
            )}

            {/* Schedule */}
            <div
              className="bg-white rounded-xl p-6"
              style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              <h2
                className="text-[16px] font-bold text-[#131b2e] mb-[18px]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Schedule
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelClass}>Calling Hours Start</label>
                    <input
                      id="startTime"
                      name="startTime"
                      type="time"
                      defaultValue="09:00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Calling Hours End</label>
                    <input
                      id="endTime"
                      name="endTime"
                      type="time"
                      defaultValue="20:00"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="timezone" className={labelClass}>
                    Timezone
                  </label>
                  <select
                    id="timezone"
                    name="timezone"
                    defaultValue="America/New_York"
                    className={inputClass}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {TIMEZONE_LABELS[tz] || tz.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Call Script */}
            <div
              className="bg-white rounded-xl p-6"
              style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              <h2
                className="text-[16px] font-bold text-[#131b2e] mb-[18px]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Call Script
              </h2>
              <textarea
                id="script"
                name="script"
                rows={8}
                placeholder={`Enter the call script your agents will follow...\n\nExample:\n'Hi [Contact Name], this is [Agent Name] from Coastal Debt Solutions. I'm reaching out because we specialize in helping people resolve outstanding debt balances.\n\nDo you have a moment to discuss some options that could potentially reduce your total debt by 40-60%?'`}
                className={`${inputClass} min-h-[160px] resize-vertical`}
              />
            </div>
          </div>

          {/* Right: Sidebar Panels */}
          <div className="space-y-5">
            {/* Contact List */}
            <div
              className="bg-white rounded-xl p-5"
              style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              <h3
                className="text-[15px] font-bold text-[#131b2e] mb-3.5"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Contact List
              </h3>
              <div className="flex items-center gap-2 bg-[#f2f3ff] px-3 py-2 rounded mb-3">
                <Search className="size-3.5 text-[#444656] flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  className="border-none bg-transparent outline-none text-[13px] text-[#131b2e] w-full placeholder-[#444656]"
                />
              </div>
              <button
                type="button"
                className="w-full py-2.5 bg-[#f2f3ff] rounded text-[13px] font-medium text-[#3052ff] mb-3 hover:bg-[#eaedff] transition-colors"
              >
                + Add from Leads
              </button>
              <div className="text-center py-7">
                <span
                  className="block text-[28px] font-extrabold text-[#131b2e] mb-1"
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  0
                </span>
                <span className="text-[13px] text-[#444656]">
                  contacts selected
                </span>
              </div>
              <div className="bg-[#f2f3ff] rounded-lg p-5 text-center text-[13px] text-[#444656]">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c4c5d9"
                  strokeWidth="1.5"
                  className="mx-auto mb-2"
                >
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                No contacts added yet.
                <br />
                Use the button above to import leads.
              </div>
            </div>

            {/* Agent Assignment */}
            <div
              className="bg-white rounded-xl p-5"
              style={{ boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
            >
              <h3
                className="text-[15px] font-bold text-[#131b2e] mb-3.5"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Agent Assignment
              </h3>
              <div className="text-[13px] text-[#444656] text-center py-4">
                Agents can be assigned after creating the campaign.
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
