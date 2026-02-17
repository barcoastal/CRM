"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneIncoming, PhoneOutgoing, MessageSquare, Calendar, Target } from "lucide-react";
import Link from "next/link";

interface CallData {
  id: string;
  direction: string;
  status: string;
  disposition: string | null;
  phoneNumber: string;
  duration: number | null;
  startedAt: string;
  notes: string | null;
  agent: { id: string; name: string };
  campaign: { id: string; name: string } | null;
}

interface CampaignContactData {
  id: string;
  attempts: number;
  status: string;
  lastAttempt: string | null;
  campaign: { id: string; name: string; status: string };
}

export interface ContactActivityLogProps {
  calls: CallData[];
  campaignContacts: CampaignContactData[];
  leadCreatedAt: string;
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const DISPOSITION_COLORS: Record<string, string> = {
  INTERESTED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  ENROLLED: "bg-green-200 text-green-900 dark:bg-green-900/50 dark:text-green-300",
  NOT_INTERESTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  DNC: "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300",
  CALLBACK: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  VOICEMAIL: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  NO_ANSWER: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
  NOT_QUALIFIED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  WRONG_NUMBER: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400",
};

export function ContactActivityLog({
  calls,
  campaignContacts,
  leadCreatedAt,
  lastContactedAt,
  nextFollowUpAt,
}: ContactActivityLogProps) {
  // Build unified timeline: calls + campaign events + milestones
  type TimelineItem =
    | { type: "call"; date: string; data: CallData }
    | { type: "campaign"; date: string; data: CampaignContactData }
    | { type: "milestone"; date: string; label: string; description?: string };

  const timeline: TimelineItem[] = [];

  // Add calls
  calls.forEach((call) => {
    timeline.push({ type: "call", date: call.startedAt, data: call });
  });

  // Add campaign contacts
  campaignContacts.forEach((cc) => {
    if (cc.lastAttempt) {
      timeline.push({ type: "campaign", date: cc.lastAttempt, data: cc });
    }
  });

  // Add milestones
  timeline.push({
    type: "milestone",
    date: leadCreatedAt,
    label: "Lead Created",
  });

  if (lastContactedAt) {
    timeline.push({
      type: "milestone",
      date: lastContactedAt,
      label: "Last Contacted",
    });
  }

  // Sort newest first
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total Calls</p>
            <p className="text-2xl font-bold">{calls.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Interested</p>
            <p className="text-2xl font-bold text-green-600">
              {calls.filter((c) => c.disposition === "INTERESTED" || c.disposition === "ENROLLED").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Campaigns</p>
            <p className="text-2xl font-bold">{campaignContacts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Next Follow-up</p>
            <p className="text-sm font-medium">
              {nextFollowUpAt
                ? new Date(nextFollowUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "--"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Call Dispositions Breakdown */}
      {calls.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Disposition History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                calls.reduce((acc, call) => {
                  const key = call.disposition || "NO_DISPOSITION";
                  acc[key] = (acc[key] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([disposition, count]) => (
                <Badge
                  key={disposition}
                  variant="secondary"
                  className={`text-xs ${DISPOSITION_COLORS[disposition] || ""}`}
                >
                  {disposition.replace(/_/g, " ")} ({count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unified Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No activity recorded yet.
            </p>
          ) : (
            <div className="space-y-1">
              {timeline.map((item, i) => (
                <div key={`${item.type}-${i}`} className="flex gap-3 py-2">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {item.type === "call" ? (
                      <div
                        className={`size-7 rounded-full flex items-center justify-center ${
                          (item.data as CallData).direction === "OUTBOUND"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }`}
                      >
                        {(item.data as CallData).direction === "OUTBOUND" ? (
                          <PhoneOutgoing className="size-3.5" />
                        ) : (
                          <PhoneIncoming className="size-3.5" />
                        )}
                      </div>
                    ) : item.type === "campaign" ? (
                      <div className="size-7 rounded-full flex items-center justify-center bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        <Target className="size-3.5" />
                      </div>
                    ) : (
                      <div className="size-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                        <Calendar className="size-3.5" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {item.type === "call" && (
                      <CallRow call={item.data as CallData} />
                    )}
                    {item.type === "campaign" && (
                      <CampaignRow cc={item.data as CampaignContactData} />
                    )}
                    {item.type === "milestone" && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {(item as { label: string }).label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.date)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CallRow({ call }: { call: CallData }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/calls/${call.id}`}
            className="text-sm font-medium hover:underline truncate"
          >
            {call.direction === "OUTBOUND" ? "Outbound" : "Inbound"} Call
          </Link>
          {call.disposition && (
            <Badge
              variant="secondary"
              className={`text-[10px] shrink-0 ${DISPOSITION_COLORS[call.disposition] || ""}`}
            >
              {call.disposition.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDuration(call.duration)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {call.agent.name}
        {call.campaign && <> &middot; {call.campaign.name}</>}
        {" "}&middot; {formatDate(call.startedAt)}
      </p>
      {call.notes && (
        <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
          <MessageSquare className="size-3 mt-0.5 shrink-0" />
          <span className="line-clamp-2">{call.notes}</span>
        </p>
      )}
    </div>
  );
}

function CampaignRow({ cc }: { cc: CampaignContactData }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate">{cc.campaign.name}</p>
        <Badge variant="secondary" className="text-[10px] shrink-0">
          {cc.status.replace(/_/g, " ")}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {cc.attempts} attempt{cc.attempts !== 1 ? "s" : ""} &middot;{" "}
        Campaign {cc.campaign.status.toLowerCase()} &middot;{" "}
        {formatDate(cc.lastAttempt)}
      </p>
    </div>
  );
}
