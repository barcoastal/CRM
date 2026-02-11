"use client";

import type { CallFeedbackData } from "@/lib/ai/types";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  Target,
  Clock,
} from "lucide-react";

interface CallFeedbackCardProps {
  feedback: CallFeedbackData;
}

function getScoreColor(score: number): {
  ring: string;
  text: string;
  bg: string;
  label: string;
} {
  if (score >= 75) {
    return {
      ring: "border-green-500",
      text: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/30",
      label: "Great",
    };
  }
  if (score >= 50) {
    return {
      ring: "border-yellow-500",
      text: "text-yellow-600",
      bg: "bg-yellow-50 dark:bg-yellow-950/30",
      label: "Good",
    };
  }
  return {
    ring: "border-red-500",
    text: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/30",
    label: "Needs Work",
  };
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function ScoreCircle({ score }: { score: number }) {
  const colors = getScoreColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "flex items-center justify-center size-20 rounded-full border-4",
          colors.ring,
          colors.bg
        )}
      >
        <span className={cn("text-2xl font-bold", colors.text)}>{score}</span>
      </div>
      <span className={cn("text-xs font-medium", colors.text)}>
        {colors.label}
      </span>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  icon: Icon,
  format = "percent",
}: {
  label: string;
  value: number;
  icon: typeof TrendingUp;
  format?: "percent" | "boolean";
}) {
  const displayValue = format === "boolean" ? (value ? "Yes" : "No") : `${value}%`;
  const barWidth = format === "boolean" ? (value ? 100 : 0) : value;
  const barColor =
    barWidth >= 70
      ? "bg-green-500"
      : barWidth >= 40
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="text-xs font-semibold">{displayValue}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${Math.min(100, barWidth)}%` }}
        />
      </div>
    </div>
  );
}

export function CallFeedbackCard({ feedback }: CallFeedbackCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Call Analysis</CardTitle>
        <CardDescription>
          Automated performance feedback based on transcript analysis
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Score + Breakdown */}
        <div className="flex items-start gap-6">
          <ScoreCircle score={feedback.overallScore} />

          <div className="flex-1 space-y-3">
            <ScoreBar
              label="Talk Ratio (Agent)"
              value={feedback.talkRatio}
              icon={MessageSquare}
            />
            <ScoreBar
              label="Objection Handling"
              value={feedback.objectionHandling}
              icon={TrendingUp}
            />
            <ScoreBar
              label="Closing Attempt"
              value={feedback.closingAttempt ? 100 : 0}
              icon={Target}
              format="boolean"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-sm leading-relaxed text-foreground/80">
            {feedback.summary}
          </p>
        </div>

        {/* Strengths */}
        {feedback.strengths.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-green-600" />
              Strengths
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {feedback.strengths.map((strength, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 text-xs font-normal"
                >
                  {strength}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Improvements */}
        {feedback.improvements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="size-4 text-yellow-600" />
              Areas for Improvement
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {feedback.improvements.map((improvement, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 text-xs font-normal"
                >
                  {improvement}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Key Moments Timeline */}
        {feedback.keyMoments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="size-4 text-blue-600" />
              Key Moments
            </h4>
            <div className="relative space-y-0">
              {feedback.keyMoments.map((moment, i) => {
                const isLast = i === feedback.keyMoments.length - 1;
                return (
                  <div key={i} className="flex gap-3">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "size-2 rounded-full mt-1.5 shrink-0",
                          moment.type === "buying_signal"
                            ? "bg-green-500"
                            : moment.type === "objection"
                              ? "bg-yellow-500"
                              : moment.type === "pain_point"
                                ? "bg-red-500"
                                : "bg-blue-500"
                        )}
                      />
                      {!isLast && (
                        <div className="w-px flex-1 bg-border min-h-[16px]" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pb-3 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {formatTimestamp(moment.timestamp)}
                        </span>
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                          {moment.type.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        {moment.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
