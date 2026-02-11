import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CallNotes } from "@/components/calls/call-notes";
import {
  ArrowLeft,
  Phone,
  Clock,
  User,
  Building2,
  Megaphone,
  ArrowUpRight,
  ArrowDownLeft,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface CallDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getDispositionColor(disposition: string | null): string {
  switch (disposition) {
    case "INTERESTED":
      return "bg-green-100 text-green-800";
    case "ENROLLED":
      return "bg-green-200 text-green-900 font-bold";
    case "NOT_INTERESTED":
      return "bg-red-100 text-red-800";
    case "DNC":
      return "bg-red-200 text-red-900 font-bold";
    case "CALLBACK":
      return "bg-yellow-100 text-yellow-800";
    case "VOICEMAIL":
    case "NO_ANSWER":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

function getScoreBgColor(score: number): string {
  if (score >= 75) return "bg-green-50 border-green-200";
  if (score >= 50) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp?: string;
}

interface KeyMoment {
  time?: string;
  description?: string;
  text?: string;
}

export default async function CallDetailPage({ params }: CallDetailPageProps) {
  const session = await auth();
  const { id } = await params;

  const call = await prisma.call.findUnique({
    where: { id },
    include: {
      lead: true,
      agent: { select: { id: true, name: true, email: true } },
      campaign: { select: { id: true, name: true } },
      transcript: true,
      feedback: true,
    },
  });

  if (!call) {
    notFound();
  }

  // Access control
  const userRole = (session?.user as { role?: string })?.role;
  const isManagerOrAdmin = userRole === "MANAGER" || userRole === "ADMIN";
  if (!isManagerOrAdmin && call.agentId !== session?.user?.id) {
    notFound();
  }

  // Parse transcript content
  let transcriptEntries: TranscriptEntry[] = [];
  if (call.transcript?.content) {
    try {
      transcriptEntries = JSON.parse(call.transcript.content);
    } catch {
      transcriptEntries = [];
    }
  }

  // Parse feedback arrays
  let keyMoments: KeyMoment[] = [];
  let improvements: string[] = [];
  let strengths: string[] = [];

  if (call.feedback) {
    try {
      if (call.feedback.keyMoments) keyMoments = JSON.parse(call.feedback.keyMoments);
    } catch {
      keyMoments = [];
    }
    try {
      if (call.feedback.improvements) improvements = JSON.parse(call.feedback.improvements);
    } catch {
      improvements = [];
    }
    try {
      if (call.feedback.strengths) strengths = JSON.parse(call.feedback.strengths);
    } catch {
      strengths = [];
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button & Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/calls"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Calls
        </Link>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Call with {call.lead?.businessName || call.phoneNumber}
        </h2>
        <p className="text-muted-foreground">
          {format(new Date(call.startedAt), "MMMM d, yyyy 'at' h:mm a")}
        </p>
      </div>

      {/* Info Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="size-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Lead</p>
                <p className="font-medium">
                  {call.lead?.businessName || "--"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {call.lead?.contactName || ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Phone className="size-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{call.phoneNumber}</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {call.direction === "OUTBOUND" ? (
                    <ArrowUpRight className="size-3 text-blue-500" />
                  ) : (
                    <ArrowDownLeft className="size-3 text-green-500" />
                  )}
                  {call.direction}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <User className="size-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Agent</p>
                <p className="font-medium">{call.agent.name}</p>
                {call.campaign && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Megaphone className="size-3" />
                    {call.campaign.name}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="size-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-medium">{formatDuration(call.duration)}</p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={getDispositionColor(call.disposition)}
                  >
                    {call.disposition || call.status}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Notes */}
      <CallNotes callId={call.id} initialNotes={call.notes || ""} />

      {/* Transcript Section */}
      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          {transcriptEntries.length > 0 ? (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {transcriptEntries.map((entry, idx) => {
                const isAgent =
                  entry.speaker.toLowerCase() === "agent" ||
                  entry.speaker.toLowerCase() === "rep";
                return (
                  <div
                    key={idx}
                    className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-4 py-2 ${
                        isAgent
                          ? "bg-blue-100 text-blue-900"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">
                          {entry.speaker}
                        </span>
                        {entry.timestamp && (
                          <span className="text-xs opacity-60">
                            {entry.timestamp}
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{entry.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No transcript available.
            </p>
          )}
          {call.transcript?.summary && (
            <div className="mt-4 rounded-lg border p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Summary
              </p>
              <p className="text-sm">{call.transcript.summary}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Feedback Section */}
      <Card>
        <CardHeader>
          <CardTitle>AI Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {call.feedback ? (
            <div className="space-y-6">
              {/* Overall Score */}
              <div className="flex items-center gap-6">
                <div
                  className={`flex size-20 items-center justify-center rounded-full border-4 ${getScoreBgColor(call.feedback.overallScore)}`}
                >
                  <span
                    className={`text-3xl font-bold ${getScoreColor(call.feedback.overallScore)}`}
                  >
                    {call.feedback.overallScore}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-semibold">Overall Score</p>
                  <p className="text-sm text-muted-foreground">
                    Based on AI analysis of the call
                  </p>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Talk Ratio</p>
                  <p className="text-xl font-bold">
                    {call.feedback.talkRatio !== null
                      ? `${Math.round(call.feedback.talkRatio * 100)}%`
                      : "--"}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">
                    Objection Handling
                  </p>
                  <p className="text-xl font-bold">
                    {call.feedback.objectionHandling !== null
                      ? `${call.feedback.objectionHandling}/100`
                      : "--"}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">
                    Closing Attempt
                  </p>
                  <p className="text-xl font-bold">
                    {call.feedback.closingAttempt !== null
                      ? call.feedback.closingAttempt
                        ? "Yes"
                        : "No"
                      : "--"}
                  </p>
                </div>
              </div>

              {/* Strengths */}
              {strengths.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Strengths</p>
                  <div className="flex flex-wrap gap-2">
                    {strengths.map((s, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-green-100 text-green-800"
                      >
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Improvements */}
              {improvements.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Areas for Improvement
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {improvements.map((imp, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-800"
                      >
                        {imp}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Moments */}
              {keyMoments.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Key Moments</p>
                  <div className="relative border-l-2 border-gray-200 pl-4 space-y-4">
                    {keyMoments.map((moment, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[1.3rem] top-1 size-2.5 rounded-full bg-blue-500" />
                        {moment.time && (
                          <span className="text-xs text-muted-foreground">
                            {moment.time}
                          </span>
                        )}
                        <p className="text-sm">
                          {moment.description || moment.text || String(moment)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              AI feedback will be available after call analysis.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recording Section */}
      <Card>
        <CardHeader>
          <CardTitle>Recording</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg border border-dashed p-6">
            <Volume2 className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Recording playback coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
