"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Phone,
  PhoneOff,
  Pause,
  Play,
  Mic,
  MicOff,
  Square,
  ChevronDown,
  ChevronRight,
  User,
  Building2,
  DollarSign,
  Mail,
  MapPin,
  Layers,
  Tag,
  Clock,
  FileText,
  SkipForward,
} from "lucide-react";

import { CampaignSelector } from "./campaign-selector";
import { CallTimer } from "./call-timer";
import { SessionStats } from "./session-stats";

import type { DialerSession, DialerContact } from "@/lib/dialer/types";
import type { CallSessionStatus } from "@/lib/telephony/types";

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

type DialerState =
  | "IDLE"
  | "SELECTING_CAMPAIGN"
  | "READY"
  | "DIALING"
  | "RINGING"
  | "CONNECTED"
  | "WRAP_UP";

interface Campaign {
  id: string;
  name: string;
  script: string | null;
  contactCount: number;
}

interface DialerClientProps {
  campaigns: Campaign[];
  initialCampaignId?: string | null;
  initialLeadId?: string | null;
}

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function formatCurrency(value: number | null): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function replaceScriptVariables(
  script: string,
  contact: DialerContact | null,
  agentName: string
): string {
  if (!contact) return script;
  return script
    .replace(/\{agent_name\}/gi, agentName)
    .replace(/\{business_name\}/gi, contact.businessName || "")
    .replace(/\{debt_estimate\}/gi, formatCurrency(contact.totalDebtEst))
    .replace(/\{industry\}/gi, contact.industry || "your industry");
}

const STATUS_MAP: Record<CallSessionStatus, DialerState> = {
  initiated: "DIALING",
  ringing: "RINGING",
  "in-progress": "CONNECTED",
  completed: "WRAP_UP",
  "no-answer": "WRAP_UP",
  busy: "WRAP_UP",
  failed: "WRAP_UP",
  voicemail: "WRAP_UP",
};

const DISPOSITIONS = [
  { value: "INTERESTED", label: "Interested" },
  { value: "CALLBACK", label: "Callback" },
  { value: "NOT_INTERESTED", label: "Not Interested" },
  { value: "NO_ANSWER", label: "No Answer" },
  { value: "WRONG_NUMBER", label: "Wrong Number" },
  { value: "VOICEMAIL", label: "Voicemail" },
  { value: "NOT_QUALIFIED", label: "Not Qualified" },
  { value: "DNC", label: "Do Not Call" },
  { value: "ENROLLED", label: "Enrolled" },
];

// -----------------------------------------------------------
// Component
// -----------------------------------------------------------

export function DialerClient({
  campaigns,
  initialCampaignId,
}: DialerClientProps) {
  // State
  const [dialerState, setDialerState] = useState<DialerState>(
    campaigns.length > 0 ? "SELECTING_CAMPAIGN" : "IDLE"
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    initialCampaignId ?? null
  );
  const [session, setSession] = useState<DialerSession | null>(null);
  const [contact, setContact] = useState<DialerContact | null>(null);
  const [callSid, setCallSid] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scriptSections, setScriptSections] = useState<Record<string, boolean>>({});

  // Inline disposition state (replaces DispositionForm for the new layout)
  const [disposition, setDisposition] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentName = "Agent"; // Placeholder — would come from session

  // Selected campaign object
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  // Contact index tracking (approximate from session stats)
  const contactIndex = session ? (session.stats.callsMade ?? 0) + 1 : 1;
  const totalContacts = selectedCampaign?.contactCount ?? 0;

  // -----------------------------------------------------------
  // API helpers
  // -----------------------------------------------------------

  const apiCall = useCallback(
    async (url: string, body?: Record<string, unknown>) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        // Stale JWT — sign out and bounce to login so the agent can start fresh
        toast.error(data.error || "Session expired. Redirecting to login…");
        await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
        setTimeout(() => {
          window.location.href = "/login?next=/dialer";
        }, 800);
        throw new Error(data.error || "Session expired");
      }
      if (!res.ok) {
        throw new Error(data.error || "API request failed");
      }
      return data;
    },
    []
  );

  // -----------------------------------------------------------
  // Polling for call status
  // -----------------------------------------------------------

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (sid: string) => {
      stopPolling();
      pollingRef.current = setInterval(async () => {
        try {
          const data = await apiCall("/api/dialer/status", { callSid: sid });
          const newState = STATUS_MAP[data.status as CallSessionStatus];
          if (newState) {
            setDialerState((prev) => {
              if (prev === "WRAP_UP") return prev;
              return newState;
            });
          }
          if (
            data.status === "completed" ||
            data.status === "no-answer" ||
            data.status === "busy" ||
            data.status === "failed" ||
            data.status === "voicemail"
          ) {
            stopPolling();
            setCallId(data.callId || null);
          }
        } catch {
          // Silently handle polling errors
        }
      }, 1000);
    },
    [apiCall, stopPolling]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // -----------------------------------------------------------
  // Session stats — poll session endpoint to keep stats in sync
  // -----------------------------------------------------------

  useEffect(() => {
    if (!session?.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/dialer/session?sessionId=${session.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            setSession(data.session);
          }
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [session?.id]);

  // Reset inline disposition when moving to a new contact
  useEffect(() => {
    setDisposition("");
    setCallNotes("");
    setNextFollowUp("");
  }, [contact?.id]);

  // -----------------------------------------------------------
  // Actions
  // -----------------------------------------------------------

  async function handleStartSession() {
    if (!selectedCampaignId) return;
    try {
      const data = await apiCall("/api/dialer/start", {
        campaignId: selectedCampaignId,
      });
      setSession(data.session);
      setContact(data.contact || null);
      setDialerState(data.contact ? "READY" : "READY");
      toast.success("Dialer session started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start session");
    }
  }

  async function handleDial() {
    if (!session || !contact) return;
    try {
      setDialerState("DIALING");
      const data = await apiCall("/api/dialer/call", {
        sessionId: session.id,
        contactId: contact.id,
      });
      setCallSid(data.callSid);
      setCallId(data.callId);
      setIsOnHold(false);
      setIsMuted(false);
      startPolling(data.callSid);
    } catch (err) {
      setDialerState("READY");
      toast.error(err instanceof Error ? err.message : "Failed to initiate call");
    }
  }

  async function handleEndCall() {
    if (!callSid) return;
    try {
      await apiCall("/api/dialer/end-call", { callSid });
      stopPolling();
      setDialerState("WRAP_UP");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to end call");
    }
  }

  async function handleHoldToggle() {
    if (!callSid) return;
    setIsOnHold((prev) => !prev);
    toast.info(isOnHold ? "Call resumed" : "Call on hold");
  }

  async function handleMuteToggle() {
    if (!callSid) return;
    setIsMuted((prev) => !prev);
    toast.info(isMuted ? "Microphone unmuted" : "Microphone muted");
  }

  async function handleDisposition(shouldStop: boolean) {
    if (!callId) {
      toast.error("No call ID available for disposition");
      return;
    }
    if (!disposition) {
      toast.error("Please select a disposition");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiCall("/api/dialer/disposition", {
        callId,
        disposition,
        notes: callNotes,
        nextFollowUp: disposition === "CALLBACK" ? nextFollowUp || null : null,
      });
      toast.success("Disposition saved");
      if (shouldStop) {
        await handleStopSession();
      } else {
        await handleNextContact();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save disposition");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleNextContact() {
    if (!session) return;
    try {
      const data = await apiCall("/api/dialer/next", { sessionId: session.id });
      if (data.contact) {
        setContact(data.contact);
        setCallSid(null);
        setCallId(null);
        setDialerState("READY");
      } else {
        toast.info("No more contacts in this campaign");
        setContact(null);
        setCallSid(null);
        setCallId(null);
        setDialerState("READY");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load next contact");
    }
  }

  async function handleSkipContact() {
    await handleNextContact();
  }

  async function handleStopSession() {
    if (!session) return;
    try {
      await apiCall("/api/dialer/stop", { sessionId: session.id });
      stopPolling();
      setSession(null);
      setContact(null);
      setCallSid(null);
      setCallId(null);
      setDialerState("SELECTING_CAMPAIGN");
      toast.success("Dialer session ended");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to stop session");
    }
  }

  // -----------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------

  const isCallActive =
    dialerState === "DIALING" ||
    dialerState === "RINGING" ||
    dialerState === "CONNECTED";

  function getStatusDisplay(): { label: string; dotColor: string } {
    switch (dialerState) {
      case "IDLE":
        return { label: "No Campaigns", dotColor: "#444656" };
      case "SELECTING_CAMPAIGN":
        return { label: "Select Campaign", dotColor: "#444656" };
      case "READY":
        return { label: "Ready", dotColor: "#1a7d37" };
      case "DIALING":
        return { label: "Dialing...", dotColor: "#3052ff" };
      case "RINGING":
        return { label: "Ringing...", dotColor: "#e6a000" };
      case "CONNECTED":
        return { label: "Connected", dotColor: "#1a7d37" };
      case "WRAP_UP":
        return { label: "Wrap-up", dotColor: "#be3900" };
      default:
        return { label: "Unknown", dotColor: "#444656" };
    }
  }

  const statusDisplay = getStatusDisplay();

  function parseScript(raw: string | null): {
    main: string;
    objections: { title: string; content: string }[];
  } {
    if (!raw) return { main: "", objections: [] };
    const sections = raw.split(/\n## /);
    const main = sections[0] || "";
    const objections = sections.slice(1).map((section) => {
      const lines = section.split("\n");
      return {
        title: lines[0]?.trim() || "Section",
        content: lines.slice(1).join("\n").trim(),
      };
    });
    return { main, objections };
  }

  const parsedScript = selectedCampaign
    ? parseScript(selectedCampaign.script)
    : { main: "", objections: [] };

  const progressPercent =
    totalContacts > 0
      ? Math.round(((contactIndex - 1) / totalContacts) * 100)
      : 0;

  // -----------------------------------------------------------
  // Pre-session: campaign selector
  // -----------------------------------------------------------

  if (!session) {
    return (
      <div className="space-y-4">
        <div
          className="rounded-sm p-6 shadow-coastal"
          style={{ background: "#ffffff" }}
        >
          {campaigns.length > 0 ? (
            <CampaignSelector
              campaigns={campaigns}
              selectedCampaignId={selectedCampaignId}
              onSelect={setSelectedCampaignId}
              onStart={handleStartSession}
            />
          ) : (
            <p className="text-sm" style={{ color: "#444656" }}>
              No active campaigns available. Create a campaign first.
            </p>
          )}
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------
  // Active session layout
  // -----------------------------------------------------------

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 120px)" }}>
      {/* Session Stats */}
      <SessionStats stats={session.stats} />

      {/* Campaign Bar */}
      <div
        className="flex items-center justify-between px-8 py-3"
        style={{ background: "#283044", color: "#fff" }}
      >
        <div className="flex items-center gap-6">
          <span
            className="font-semibold text-sm"
            style={{ fontFamily: "var(--font-sans, sans-serif)", letterSpacing: "-0.3px" }}
          >
            {selectedCampaign?.name ?? "Campaign"}
          </span>
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
            Contact{" "}
            <strong className="text-white font-semibold">{contactIndex}</strong>{" "}
            of{" "}
            <strong className="text-white font-semibold">{totalContacts}</strong>
          </span>
          {/* Progress bar */}
          <div
            className="rounded-full overflow-hidden"
            style={{ width: 120, height: 4, background: "rgba(255,255,255,0.15)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                background: "#3052ff",
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", cursor: "pointer" }}
            disabled={isCallActive}
            onClick={() => toast.info("Session paused")}
          >
            <Pause className="size-3" />
            Pause
          </button>
          <button
            className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ background: "rgba(186,26,26,0.8)", color: "#fff", border: "none", cursor: isCallActive ? "not-allowed" : "pointer", opacity: isCallActive ? 0.6 : 1 }}
            disabled={isCallActive}
            onClick={handleStopSession}
          >
            <Square className="size-3" />
            Stop
          </button>
        </div>
      </div>

      {/* Split Screen */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL — Dialer Controls (45%) */}
        <div
          className="flex flex-col gap-5 overflow-y-auto p-8"
          style={{ width: "45%", background: "#eaedff" }}
        >
          {/* Phone number display */}
          <div className="text-center">
            <div
              className="font-bold tracking-widest"
              style={{
                fontFamily: "var(--font-sans, sans-serif)",
                fontSize: 30,
                color: "#131b2e",
                letterSpacing: 2,
              }}
            >
              {contact?.phone ?? "— — —"}
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2">
            <span
              className="inline-block rounded-full"
              style={{
                width: 8,
                height: 8,
                background: statusDisplay.dotColor,
                boxShadow: `0 0 6px ${statusDisplay.dotColor}88`,
              }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: statusDisplay.dotColor }}
            >
              {statusDisplay.label}
            </span>
          </div>

          {/* Call timer */}
          <div className="text-center">
            <div
              className="font-bold"
              style={{
                fontFamily: "var(--font-sans, sans-serif)",
                fontSize: 48,
                color: "#0034e4",
                lineHeight: 1,
              }}
            >
              <CallTimer isActive={dialerState === "CONNECTED"} />
            </div>
          </div>

          {/* Dial / Hangup buttons */}
          <div className="flex items-center justify-center gap-5">
            {/* Dial — only when READY */}
            {dialerState === "READY" && contact && (
              <button
                onClick={handleDial}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  border: "none",
                  background: "linear-gradient(135deg, #1a7d37, #22a647)",
                  boxShadow: "0 8px 24px rgba(26,125,55,0.35)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  transition: "transform 0.1s",
                }}
              >
                <Phone style={{ width: 26, height: 26 }} />
              </button>
            )}

            {/* Hangup — when in call */}
            {isCallActive && (
              <button
                onClick={handleEndCall}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  border: "none",
                  background: "linear-gradient(135deg, #ba1a1a, #d42626)",
                  boxShadow: "0 8px 24px rgba(186,26,26,0.35)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  transition: "transform 0.1s",
                }}
              >
                <PhoneOff style={{ width: 26, height: 26 }} />
              </button>
            )}

            {/* Hold — only when CONNECTED */}
            {dialerState === "CONNECTED" && (
              <button
                onClick={handleHoldToggle}
                className={cn(
                  "flex items-center justify-center rounded-full transition-colors"
                )}
                style={{
                  width: 52,
                  height: 52,
                  border: "none",
                  background: isOnHold ? "#3052ff" : "rgba(255,255,255,0.7)",
                  color: isOnHold ? "#fff" : "#444656",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(19,27,46,0.1)",
                }}
              >
                {isOnHold ? (
                  <Play style={{ width: 20, height: 20 }} />
                ) : (
                  <Pause style={{ width: 20, height: 20 }} />
                )}
              </button>
            )}

            {/* Mute — only when CONNECTED */}
            {dialerState === "CONNECTED" && (
              <button
                onClick={handleMuteToggle}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  border: "none",
                  background: isMuted ? "#3052ff" : "rgba(255,255,255,0.7)",
                  color: isMuted ? "#fff" : "#444656",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(19,27,46,0.1)",
                }}
              >
                {isMuted ? (
                  <MicOff style={{ width: 20, height: 20 }} />
                ) : (
                  <Mic style={{ width: 20, height: 20 }} />
                )}
              </button>
            )}
          </div>

          {/* Disposition grid */}
          <div>
            <div
              className="mb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#444656" }}
            >
              Disposition
            </div>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
            >
              {DISPOSITIONS.slice(0, 5).map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDisposition(d.value)}
                  className="rounded-sm py-2.5 px-2 text-xs font-semibold transition-all"
                  style={{
                    border: "none",
                    background:
                      disposition === d.value ? "#0034e4" : "#ffffff",
                    color: disposition === d.value ? "#fff" : "#444656",
                    cursor: "pointer",
                    boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {/* More dispositions row */}
            <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              {DISPOSITIONS.slice(5).map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDisposition(d.value)}
                  className="rounded-sm py-2 px-2 text-xs font-semibold transition-all"
                  style={{
                    border: "none",
                    background:
                      disposition === d.value ? "#0034e4" : "#ffffff",
                    color: disposition === d.value ? "#fff" : "#444656",
                    cursor: "pointer",
                    boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Callback follow-up date (conditional) */}
          {disposition === "CALLBACK" && (
            <div>
              <div
                className="mb-1.5 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#444656" }}
              >
                Follow-up Date &amp; Time
              </div>
              <input
                type="datetime-local"
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                className="w-full rounded-sm px-3 py-2 text-sm outline-none"
                style={{
                  border: "none",
                  background: "#ffffff",
                  color: "#131b2e",
                  boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                }}
              />
            </div>
          )}

          {/* Call Notes */}
          <div>
            <div
              className="mb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#444656" }}
            >
              Call Notes
            </div>
            <textarea
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="Add notes about this call..."
              rows={3}
              className="w-full rounded-sm px-3.5 py-3 text-sm outline-none resize-y"
              style={{
                border: "none",
                background: "#ffffff",
                color: "#131b2e",
                boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Bottom actions */}
          <div className="mt-auto flex gap-2.5">
            <button
              onClick={() => handleDisposition(false)}
              disabled={!disposition || isSubmitting || isCallActive}
              className="flex flex-1 items-center justify-center gap-2 rounded-sm py-3 text-sm font-semibold transition-opacity"
              style={{
                border: "none",
                background: "linear-gradient(135deg, #0034e4, #3052ff)",
                color: "#fff",
                cursor:
                  !disposition || isSubmitting || isCallActive
                    ? "not-allowed"
                    : "pointer",
                opacity: !disposition || isSubmitting || isCallActive ? 0.5 : 1,
              }}
            >
              <SkipForward className="size-4" />
              Next Contact
            </button>
            <button
              onClick={handleSkipContact}
              disabled={isSubmitting || isCallActive}
              className="flex flex-1 items-center justify-center gap-2 rounded-sm py-3 text-sm font-semibold transition-opacity"
              style={{
                border: "none",
                background: "#ffffff",
                color: "#444656",
                cursor: isSubmitting || isCallActive ? "not-allowed" : "pointer",
                opacity: isSubmitting || isCallActive ? 0.5 : 1,
                boxShadow: "0 12px 40px rgba(19,27,46,0.06)",
              }}
            >
              Skip
            </button>
          </div>

          {/* Submit & Stop (secondary action) */}
          {dialerState === "WRAP_UP" && (
            <button
              onClick={() => handleDisposition(true)}
              disabled={!disposition || isSubmitting}
              className="w-full rounded-sm py-2.5 text-xs font-semibold transition-opacity"
              style={{
                border: "none",
                background: "rgba(186,26,26,0.12)",
                color: "#ba1a1a",
                cursor: !disposition || isSubmitting ? "not-allowed" : "pointer",
                opacity: !disposition || isSubmitting ? 0.5 : 1,
              }}
            >
              Submit &amp; Stop Session
            </button>
          )}
        </div>

        {/* RIGHT PANEL — Lead Info (55%) */}
        <div
          className="flex flex-col overflow-y-auto p-8"
          style={{ width: "55%", background: "#ffffff" }}
        >
          {contact ? (
            <>
              {/* Lead header */}
              <div className="mb-6">
                <h2
                  className="font-bold mb-1"
                  style={{
                    fontFamily: "var(--font-sans, sans-serif)",
                    fontSize: 22,
                    color: "#131b2e",
                  }}
                >
                  {contact.businessName}
                </h2>
                <div className="flex items-center gap-2 text-sm" style={{ color: "#444656" }}>
                  <User className="size-3.5" />
                  <span>{contact.contactName}</span>
                </div>
              </div>

              {/* Info grid */}
              <div
                className="grid gap-3 mb-7"
                style={{ gridTemplateColumns: "1fr 1fr" }}
              >
                <InfoItem
                  label="Phone"
                  value={contact.phone}
                  icon={<Phone className="size-3" />}
                />
                <InfoItem
                  label="Email"
                  value="—"
                  icon={<Mail className="size-3" />}
                />
                <InfoItem
                  label="Address"
                  value="—"
                  icon={<MapPin className="size-3" />}
                />
                <InfoItem
                  label="Total Debt"
                  value={formatCurrency(contact.totalDebtEst)}
                  icon={<DollarSign className="size-3" />}
                  highlight
                />
                <InfoItem
                  label="Industry"
                  value={contact.industry ?? "—"}
                  icon={<Layers className="size-3" />}
                />
                <InfoItem
                  label="Lead Score"
                  value={contact.score != null ? String(contact.score) : "—"}
                  icon={<Tag className="size-3" />}
                />
                <InfoItem
                  label="Attempts"
                  value={String(contact.attempts)}
                  icon={<Phone className="size-3" />}
                />
              </div>

              {/* Previous calls section */}
              <div className="mb-7">
                <div
                  className="font-bold mb-3 text-sm"
                  style={{ fontFamily: "var(--font-sans, sans-serif)", color: "#131b2e" }}
                >
                  Previous Calls
                </div>
                <div
                  className="rounded-sm px-4 py-3 text-sm"
                  style={{ background: "#f2f3ff", color: "#444656" }}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 shrink-0" />
                    <span>No previous call history with this lead.</span>
                  </div>
                </div>
              </div>

              {/* Call Script */}
              {selectedCampaign?.script && (
                <div>
                  <div
                    className="font-bold mb-3 text-sm flex items-center gap-2"
                    style={{ fontFamily: "var(--font-sans, sans-serif)", color: "#131b2e" }}
                  >
                    <FileText className="size-4" />
                    Call Script
                  </div>
                  <div
                    className="rounded-xl overflow-y-auto"
                    style={{
                      maxHeight: 300,
                      background: "#f2f3ff",
                      padding: "20px",
                    }}
                  >
                    {/* Main script paragraphs — highlight KEY lines */}
                    {replaceScriptVariables(parsedScript.main, contact, agentName)
                      .split("\n")
                      .filter(Boolean)
                      .map((line, i) => {
                        const isKeyPoint =
                          line.toLowerCase().startsWith("key:") ||
                          line.toUpperCase().startsWith("KEY:");
                        return isKeyPoint ? (
                          <div
                            key={i}
                            className="rounded-sm px-3 py-2 mb-2.5 text-sm font-medium leading-relaxed"
                            style={{
                              background: "rgba(48,82,255,0.1)",
                              color: "#0034e4",
                            }}
                          >
                            {line}
                          </div>
                        ) : (
                          <p
                            key={i}
                            className="text-sm leading-relaxed mb-3"
                            style={{ color: "#444656" }}
                          >
                            {line}
                          </p>
                        );
                      })}

                    {/* Objection handling accordion sections */}
                    {parsedScript.objections.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {parsedScript.objections.map((section, idx) => {
                          const isOpen = scriptSections[section.title] ?? false;
                          return (
                            <div
                              key={idx}
                              className="rounded-sm overflow-hidden"
                              style={{ background: "rgba(255,255,255,0.7)" }}
                            >
                              <button
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-semibold text-left"
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: "#131b2e",
                                  cursor: "pointer",
                                }}
                                onClick={() =>
                                  setScriptSections((prev) => ({
                                    ...prev,
                                    [section.title]: !isOpen,
                                  }))
                                }
                              >
                                {isOpen ? (
                                  <ChevronDown className="size-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="size-4 shrink-0" />
                                )}
                                {section.title}
                              </button>
                              {isOpen && (
                                <div
                                  className="px-3 pb-3 text-sm whitespace-pre-wrap leading-relaxed"
                                  style={{ color: "#444656" }}
                                >
                                  {replaceScriptVariables(
                                    section.content,
                                    contact,
                                    agentName
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            // No contact state
            <div className="flex flex-1 flex-col items-center justify-center text-center py-16">
              <div
                className="mb-4 flex items-center justify-center rounded-full"
                style={{
                  width: 64,
                  height: 64,
                  background: "#f2f3ff",
                }}
              >
                <Phone
                  style={{ width: 28, height: 28, color: "#444656", opacity: 0.5 }}
                />
              </div>
              <p className="text-sm font-medium" style={{ color: "#444656" }}>
                No more contacts available in this campaign.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------
// InfoItem sub-component
// -----------------------------------------------------------

function InfoItem({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-sm px-4 py-3"
      style={{
        background: highlight ? "rgba(48,82,255,0.08)" : "#f2f3ff",
      }}
    >
      <div
        className="flex items-center gap-1 mb-1 text-xs font-semibold uppercase tracking-wide"
        style={{ color: "#444656" }}
      >
        {icon}
        {label}
      </div>
      <div
        className="font-semibold"
        style={{
          color: highlight ? "#0034e4" : "#131b2e",
          fontSize: highlight ? 18 : 13,
          fontFamily: highlight ? "var(--font-sans, sans-serif)" : "inherit",
          fontWeight: highlight ? 800 : 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}
