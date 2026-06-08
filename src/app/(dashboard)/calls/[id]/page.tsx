import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CallNotes } from "@/components/calls/call-notes";
import {
  Phone,
  Clock,
  User,
  Megaphone,
  Calendar,
} from "@/components/icons/lucide";
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

function DispositionBadge({ disposition }: { disposition: string | null }) {
  if (!disposition) return null;

  const styleMap: Record<string, string> = {
    INTERESTED: "bg-[#dcfce7] text-[#15803d]",
    ENROLLED: "bg-[#dcfce7] text-[#14532d] font-bold",
    CALLBACK: "bg-[#dbeafe] text-[#1d4ed8]",
    NOT_INTERESTED: "bg-[#fee2e2] text-[#b91c1c]",
    DNC: "bg-[#fee2e2] text-[#991b1b] font-bold",
    NO_ANSWER: "bg-[#f1f1f5] text-[#6b7280]",
    VOICEMAIL: "bg-[#f1f1f5] text-[#6b7280]",
    WRONG_NUMBER: "bg-[#ffedd5] text-[#c2410c]",
    NOT_QUALIFIED: "bg-[#f1f1f5] text-[#6b7280]",
  };

  const labelMap: Record<string, string> = {
    INTERESTED: "Interested",
    ENROLLED: "Enrolled",
    CALLBACK: "Callback",
    NOT_INTERESTED: "Not Interested",
    DNC: "DNC",
    NO_ANSWER: "No Answer",
    VOICEMAIL: "Voicemail",
    WRONG_NUMBER: "Wrong Number",
    NOT_QUALIFIED: "Not Qualified",
  };

  const cls = styleMap[disposition] ?? "bg-[#f1f1f5] text-[#6b7280]";
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[12px] font-semibold ${cls}`}>
      {labelMap[disposition] ?? disposition}
    </span>
  );
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

// SVG circular progress ring for overall score
function ScoreRing({ score }: { score: number }) {
  const r = 38;
  const circumference = 2 * Math.PI * r; // ~238.76
  const offset = circumference - (score / 100) * circumference;

  const strokeColor =
    score >= 75 ? "#16a34a" : score >= 50 ? "#ca8a04" : "#dc2626";

  return (
    <div className="relative w-[90px] h-[90px] shrink-0">
      <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="45" cy="45" r={r} fill="none" stroke="#eaedff" strokeWidth="7" />
        <circle
          cx="45"
          cy="45"
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-extrabold text-[#131b2e] leading-none"
          style={{ fontFamily: "var(--font-sans)" }}>
          {score}
        </span>
        <span className="text-[10px] text-[#444656] leading-none mt-0.5">/ 100</span>
      </div>
    </div>
  );
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

  const leadName = call.lead?.businessName || call.lead?.contactName || call.phoneNumber;
  const agentTalk = call.feedback?.talkRatio !== null && call.feedback?.talkRatio !== undefined
    ? Math.round(call.feedback.talkRatio * 100)
    : null;
  const leadTalk = agentTalk !== null ? 100 - agentTalk : null;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[13px] text-[#444656]">
        <Link href="/calls" className="text-[#3052ff] font-medium hover:underline">
          Calls
        </Link>
        <span className="text-[#c4c5d9]">›</span>
        <span>Call #{id.slice(0, 8).toUpperCase()}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-[24px] font-bold tracking-tight text-[#131b2e]">
          {leadName}
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-[13.5px] text-[#444656]">
            <Calendar className="size-[15px]" />
            {format(new Date(call.startedAt), "MMM d, yyyy h:mm a")}
          </span>
          <span className="inline-block px-3 py-1 rounded-full bg-[#f2f3ff] text-[#3052ff] text-[13px] font-semibold">
            {formatDuration(call.duration)}
          </span>
          <DispositionBadge disposition={call.disposition} />
        </div>
      </div>

      {/* Meta pills row */}
      <div className="flex flex-wrap gap-3 text-[13px] text-[#444656]">
        <span className="flex items-center gap-1.5">
          <Phone className="size-[14px]" />
          {call.phoneNumber}
          {" — "}
          <span className={call.direction === "OUTBOUND" ? "text-[#16a34a] font-semibold" : "text-[#3052ff] font-semibold"}>
            {call.direction === "OUTBOUND" ? "↑ Outbound" : "↓ Inbound"}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <User className="size-[14px]" />
          {call.agent.name}
        </span>
        {call.campaign && (
          <span className="flex items-center gap-1.5">
            <Megaphone className="size-[14px]" />
            {call.campaign.name}
          </span>
        )}
        {call.duration && (
          <span className="flex items-center gap-1.5">
            <Clock className="size-[14px]" />
            {formatDuration(call.duration)}
          </span>
        )}
      </div>

      {/* SPLIT LAYOUT */}
      <div className="grid gap-6" style={{ gridTemplateColumns: "55% 45%" }}>

        {/* ── LEFT: Transcript ── */}
        <div className="flex flex-col gap-4">

          {/* Summary box */}
          {call.transcript?.summary && (
            <div className="bg-[#f2f3ff] rounded-xl p-5">
              <h3 className="text-[14px] font-bold text-[#131b2e] mb-2">
                Transcript Summary
              </h3>
              <p className="text-[13.5px] leading-relaxed text-[#444656]">
                {call.transcript.summary}
              </p>
            </div>
          )}

          {/* Scrollable transcript */}
          <div className="bg-white rounded-xl shadow-coastal overflow-hidden">
            {transcriptEntries.length > 0 ? (
              <div className="max-h-[600px] overflow-y-auto divide-y divide-[rgba(196,197,217,0.1)]">
                {transcriptEntries.map((entry, idx) => {
                  const isAgent =
                    entry.speaker.toLowerCase() === "agent" ||
                    entry.speaker.toLowerCase() === "rep";
                  return (
                    <div
                      key={idx}
                      className={`px-5 py-4 ${isAgent ? "bg-white" : "bg-[#f2f3ff]"}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[12px] font-semibold ${
                            isAgent ? "text-[#3052ff]" : "text-[#444656]"
                          }`}
                        >
                          {entry.speaker}
                          {isAgent ? " (Agent)" : ""}
                        </span>
                        {entry.timestamp && (
                          <span className="text-[11px] text-[#999]">
                            {entry.timestamp}
                          </span>
                        )}
                      </div>
                      <p className="text-[13.5px] leading-[1.65] text-[#131b2e]">
                        {entry.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-10 text-center text-[13px] text-[#444656]">
                No transcript available.
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: AI Intelligence panel ── */}
        <div className="flex flex-col gap-4">

          {call.feedback ? (
            <>
              {/* Score + metrics card */}
              <div className="bg-white rounded-xl shadow-coastal p-6">
                <h3 className="text-[15px] font-bold text-[#131b2e] mb-5">
                  AI Call Intelligence
                </h3>

                {/* Overall score */}
                <div className="flex items-center gap-6 mb-5">
                  <ScoreRing score={call.feedback.overallScore} />
                  <div>
                    <p className="text-[14px] font-bold text-[#131b2e] mb-1">
                      Overall Score
                    </p>
                    <p className="text-[13px] text-[#444656] leading-snug">
                      {call.feedback.overallScore >= 75
                        ? "Strong performance on this call."
                        : call.feedback.overallScore >= 50
                        ? "Average performance. Room to improve."
                        : "Below average. Review key moments."}
                    </p>
                  </div>
                </div>

                {/* Talk ratio bar */}
                {agentTalk !== null && leadTalk !== null && (
                  <div className="mb-5">
                    <div className="flex justify-between text-[12px] text-[#444656] mb-1.5">
                      <span>Agent {agentTalk}%</span>
                      <span>Lead {leadTalk}%</span>
                    </div>
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-[#f2f3ff]">
                      <div
                        className="gradient-primary"
                        style={{ width: `${agentTalk}%` }}
                      />
                      <div
                        className="bg-[#c4c5d9]"
                        style={{ width: `${leadTalk}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Objection handling */}
                {call.feedback.objectionHandling !== null && (
                  <div className="flex items-center justify-between py-2.5 border-t border-[rgba(196,197,217,0.15)]">
                    <span className="text-[13px] text-[#444656]">Objection Handling</span>
                    <span className="text-[13.5px] font-semibold text-[#131b2e]">
                      {call.feedback.objectionHandling} / 10
                    </span>
                  </div>
                )}

                {/* Closing attempt */}
                {call.feedback.closingAttempt !== null && (
                  <div className="flex items-center justify-between py-2.5 border-t border-[rgba(196,197,217,0.15)]">
                    <span className="text-[13px] text-[#444656]">Closing Attempt</span>
                    <span
                      className={`text-[13.5px] font-semibold ${
                        call.feedback.closingAttempt ? "text-[#16a34a]" : "text-[#444656]"
                      }`}
                    >
                      {call.feedback.closingAttempt ? "✓ Yes" : "✗ No"}
                    </span>
                  </div>
                )}
              </div>

              {/* Strengths + Improvements card */}
              {(strengths.length > 0 || improvements.length > 0) && (
                <div className="bg-white rounded-xl shadow-coastal p-6">
                  {strengths.length > 0 && (
                    <>
                      <p className="text-[12px] font-semibold text-[#444656] uppercase tracking-wide mb-2">
                        Strengths
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {strengths.map((s, i) => (
                          <span
                            key={i}
                            className="inline-block px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#dcfce7] text-[#15803d]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {improvements.length > 0 && (
                    <>
                      <p className="text-[12px] font-semibold text-[#444656] uppercase tracking-wide mb-2">
                        Areas for Improvement
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {improvements.map((imp, i) => (
                          <span
                            key={i}
                            className="inline-block px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#fef9c3] text-[#a16207]"
                          >
                            {imp}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Key Moments card */}
              {keyMoments.length > 0 && (
                <div className="bg-white rounded-xl shadow-coastal p-6">
                  <p className="text-[12px] font-semibold text-[#444656] uppercase tracking-wide mb-3">
                    Key Moments
                  </p>
                  <div className="space-y-0">
                    {keyMoments.map((moment, i) => (
                      <div key={i} className="flex gap-2.5 py-2">
                        {moment.time && (
                          <span className="text-[12px] font-semibold text-[#3052ff] min-w-[42px] pt-0.5 shrink-0">
                            {moment.time}
                          </span>
                        )}
                        <p className="text-[13px] text-[#131b2e] leading-snug">
                          {moment.description || moment.text || String(moment)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-coastal p-6">
              <h3 className="text-[15px] font-bold text-[#131b2e] mb-3">
                AI Call Intelligence
              </h3>
              <p className="text-[13px] text-[#444656]">
                AI feedback will be available after call analysis.
              </p>
            </div>
          )}

          {/* Call Notes — inline in AI panel */}
          <div className="bg-white rounded-xl shadow-coastal p-6">
            <h3 className="text-[15px] font-bold text-[#131b2e] mb-3">
              Call Notes
            </h3>
            <CallNotes callId={call.id} initialNotes={call.notes || ""} />
          </div>
        </div>
      </div>
    </div>
  );
}
