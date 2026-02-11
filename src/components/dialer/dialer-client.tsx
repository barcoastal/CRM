"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Star,
  Clock,
  FileText,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import { CampaignSelector } from "./campaign-selector";
import { CallTimer } from "./call-timer";
import { SessionStats } from "./session-stats";
import { DispositionForm } from "./disposition-form";

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
  const [scriptSections, setScriptSections] = useState<Record<string, boolean>>(
    {}
  );

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const agentName = "Agent"; // Placeholder — would come from session

  // Selected campaign object
  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

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
      const data = await res.json();
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
              // Only transition forward, not backward
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
        const res = await fetch(
          `/api/dialer/session?sessionId=${session.id}`
        );
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
      toast.error(
        err instanceof Error ? err.message : "Failed to start session"
      );
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
      toast.error(
        err instanceof Error ? err.message : "Failed to initiate call"
      );
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
    // The telephony API handles hold/resume based on current state
    // We just toggle the UI state; in production this would call the API
    setIsOnHold((prev) => !prev);
    toast.info(isOnHold ? "Call resumed" : "Call on hold");
  }

  async function handleMuteToggle() {
    if (!callSid) return;
    setIsMuted((prev) => !prev);
    toast.info(isMuted ? "Microphone unmuted" : "Microphone muted");
  }

  async function handleDisposition(
    disposition: string,
    notes: string,
    nextFollowUp?: string,
    shouldStop?: boolean
  ) {
    if (!callId) {
      toast.error("No call ID available for disposition");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiCall("/api/dialer/disposition", {
        callId,
        disposition,
        notes,
        nextFollowUp: nextFollowUp || null,
      });
      toast.success("Disposition saved");

      if (shouldStop) {
        await handleStopSession();
      } else {
        // Load next contact
        await handleNextContact();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save disposition"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleNextContact() {
    if (!session) return;
    try {
      const data = await apiCall("/api/dialer/next", {
        sessionId: session.id,
      });
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
      toast.error(
        err instanceof Error ? err.message : "Failed to load next contact"
      );
    }
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
      toast.error(
        err instanceof Error ? err.message : "Failed to stop session"
      );
    }
  }

  // -----------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------

  const isCallActive =
    dialerState === "DIALING" ||
    dialerState === "RINGING" ||
    dialerState === "CONNECTED";

  function getStatusDisplay(): { label: string; color: string } {
    switch (dialerState) {
      case "IDLE":
        return { label: "No Campaigns", color: "bg-muted text-muted-foreground" };
      case "SELECTING_CAMPAIGN":
        return { label: "Select Campaign", color: "bg-muted text-muted-foreground" };
      case "READY":
        return { label: "Ready", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
      case "DIALING":
        return { label: "Dialing...", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
      case "RINGING":
        return { label: "Ringing...", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
      case "CONNECTED":
        return { label: "Connected", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
      case "WRAP_UP":
        return { label: "Wrap-up", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
      default:
        return { label: "Unknown", color: "bg-muted text-muted-foreground" };
    }
  }

  const statusDisplay = getStatusDisplay();

  // Parse script into sections (main script + objection handling sections)
  function parseScript(raw: string | null): { main: string; objections: { title: string; content: string }[] } {
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

  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Session Stats Bar */}
      {session && <SessionStats stats={session.stats} />}

      {/* Three-column layout */}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr_320px]">
        {/* LEFT COLUMN — Contact Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4" />
                Contact Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {contact.businessName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="size-3.5 text-muted-foreground" />
                      <span className="text-sm">{contact.contactName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 text-muted-foreground" />
                      <span className="text-sm font-mono">{contact.phone}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {contact.industry && (
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Industry
                        </span>
                        <p className="font-medium">{contact.industry}</p>
                      </div>
                    )}
                    {contact.totalDebtEst != null && (
                      <div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="size-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Debt Est.
                          </span>
                        </div>
                        <p className="font-medium">
                          {formatCurrency(contact.totalDebtEst)}
                        </p>
                      </div>
                    )}
                    {contact.score != null && (
                      <div>
                        <div className="flex items-center gap-1">
                          <Star className="size-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Score
                          </span>
                        </div>
                        <p className="font-medium">{contact.score}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Attempts
                      </span>
                      <p className="font-medium">{contact.attempts}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Phone className="size-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {session
                      ? "No more contacts available"
                      : "Select a campaign to start dialing"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent call history placeholder */}
          {contact && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="size-4" />
                  Recent History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No previous call history with this lead.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* CENTER COLUMN — Call Controls + Script */}
        <div className="space-y-4">
          {/* Campaign selector or session controls */}
          {!session ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Campaign</CardTitle>
              </CardHeader>
              <CardContent>
                {campaigns.length > 0 ? (
                  <CampaignSelector
                    campaigns={campaigns}
                    selectedCampaignId={selectedCampaignId}
                    onSelect={setSelectedCampaignId}
                    onStart={handleStartSession}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No active campaigns available. Create a campaign first.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {selectedCampaign?.name || "Campaign"}
                  </CardTitle>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleStopSession}
                    disabled={isCallActive}
                  >
                    <Square className="size-3.5" />
                    Stop Session
                  </Button>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Status Indicator */}
          <div className="flex flex-col items-center gap-4 py-2">
            <Badge
              className={cn(
                "px-4 py-1.5 text-sm font-semibold",
                statusDisplay.color
              )}
            >
              {statusDisplay.label}
            </Badge>

            <CallTimer isActive={dialerState === "CONNECTED"} />
          </div>

          {/* Call Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Dial button — only when READY */}
            {dialerState === "READY" && contact && (
              <Button
                size="lg"
                className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700 text-white"
                onClick={handleDial}
              >
                <Phone className="size-6" />
              </Button>
            )}

            {/* End Call button — when in call */}
            {isCallActive && (
              <Button
                size="lg"
                className="h-14 w-14 rounded-full"
                variant="destructive"
                onClick={handleEndCall}
              >
                <PhoneOff className="size-6" />
              </Button>
            )}

            {/* Hold toggle — only when CONNECTED */}
            {dialerState === "CONNECTED" && (
              <Button
                size="lg"
                variant={isOnHold ? "default" : "outline"}
                className="h-12 w-12 rounded-full"
                onClick={handleHoldToggle}
              >
                {isOnHold ? (
                  <Play className="size-5" />
                ) : (
                  <Pause className="size-5" />
                )}
              </Button>
            )}

            {/* Mute toggle — only when CONNECTED */}
            {dialerState === "CONNECTED" && (
              <Button
                size="lg"
                variant={isMuted ? "default" : "outline"}
                className="h-12 w-12 rounded-full"
                onClick={handleMuteToggle}
              >
                {isMuted ? (
                  <MicOff className="size-5" />
                ) : (
                  <Mic className="size-5" />
                )}
              </Button>
            )}
          </div>

          {/* Disposition Form */}
          {dialerState === "WRAP_UP" && (
            <DispositionForm
              onSubmitAndNext={(d, n, f) => handleDisposition(d, n, f, false)}
              onSubmitAndStop={(d, n, f) => handleDisposition(d, n, f, true)}
              isSubmitting={isSubmitting}
            />
          )}

          {/* Call Script */}
          {session && selectedCampaign?.script && dialerState !== "WRAP_UP" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4" />
                  Call Script
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-y-auto space-y-4">
                  {/* Main script */}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {replaceScriptVariables(
                      parsedScript.main,
                      contact,
                      agentName
                    )}
                  </div>

                  {/* Objection handling sections */}
                  {parsedScript.objections.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        {parsedScript.objections.map((section, idx) => {
                          const isOpen = scriptSections[section.title] ?? false;
                          return (
                            <div
                              key={idx}
                              className="rounded-md border"
                            >
                              <button
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-left hover:bg-accent/50 transition-colors"
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
                                <div className="px-3 pb-3 text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
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
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN — AI Panel */}
        <div className="space-y-4">
          {/* Live Transcript */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="size-4" />
                Live Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="size-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Transcript will appear here during calls
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Coaching Tips */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" />
                AI Coaching Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="size-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  AI coaching tips will appear here
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
