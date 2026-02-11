"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface LeadScoreBadgeProps {
  leadId: string;
  score: number | null;
  reason: string | null;
}

function getScoreColor(score: number): string {
  if (score >= 75) return "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700";
  if (score >= 50) return "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700";
  return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700";
}

export function LeadScoreBadge({ leadId, score: initialScore, reason: initialReason }: LeadScoreBadgeProps) {
  const [score, setScore] = useState(initialScore);
  const [reason, setReason] = useState(initialReason);
  const [loading, setLoading] = useState(false);

  const handleRescore = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/score-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      if (res.ok) {
        const data = await res.json();
        setScore(data.score);
        setReason(data.reason);
      }
    } finally {
      setLoading(false);
    }
  };

  if (score === null || score === undefined) {
    return (
      <Button
        variant="outline"
        size="xs"
        onClick={handleRescore}
        disabled={loading}
        className="gap-1"
      >
        <RefreshCw className={cn("size-3", loading && "animate-spin")} />
        Score
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center size-8 rounded-full border text-xs font-bold tabular-nums cursor-pointer transition-colors",
              getScoreColor(score)
            )}
            title={reason || undefined}
          >
            {score}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 text-sm" side="top">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">AI Score: {score}/100</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleRescore}
                disabled={loading}
              >
                <RefreshCw className={cn("size-3", loading && "animate-spin")} />
              </Button>
            </div>
            {reason && (
              <p className="text-muted-foreground text-xs leading-relaxed">
                {reason}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
