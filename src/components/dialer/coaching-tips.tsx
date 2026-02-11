"use client";

import { useState, useEffect, useRef } from "react";
import type { CoachingTip } from "@/lib/ai/types";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  AlertTriangle,
  Lightbulb,
  ShieldAlert,
  X,
} from "lucide-react";

interface CoachingTipsProps {
  tips: CoachingTip[];
  isActive: boolean;
}

const tipConfig: Record<
  CoachingTip["type"],
  { borderColor: string; bgColor: string; iconColor: string; icon: typeof Sparkles; label: string }
> = {
  buying_signal: {
    borderColor: "border-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    iconColor: "text-green-600",
    icon: Sparkles,
    label: "Buying Signal",
  },
  objection: {
    borderColor: "border-yellow-400",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    iconColor: "text-yellow-600",
    icon: AlertTriangle,
    label: "Objection",
  },
  suggestion: {
    borderColor: "border-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-600",
    icon: Lightbulb,
    label: "Suggestion",
  },
  warning: {
    borderColor: "border-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    iconColor: "text-red-600",
    icon: ShieldAlert,
    label: "Warning",
  },
};

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function CoachingTips({ tips, isActive }: CoachingTipsProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const prevTipCountRef = useRef(0);

  const visibleTips = tips.filter((tip) => !dismissedIds.has(tip.id));

  // Trigger animation for newly added tips
  useEffect(() => {
    if (tips.length > prevTipCountRef.current) {
      const newTips = tips.slice(prevTipCountRef.current);
      const newIds = new Set(newTips.map((t) => t.id));
      setAnimatingIds(newIds);

      const timer = setTimeout(() => {
        setAnimatingIds(new Set());
      }, 500);

      prevTipCountRef.current = tips.length;
      return () => clearTimeout(timer);
    }
    prevTipCountRef.current = tips.length;
  }, [tips]);

  const dismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-sm font-semibold">AI Coaching</h3>
        {isActive && (
          <span className="text-xs text-muted-foreground">
            {visibleTips.length} tip{visibleTips.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {visibleTips.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {isActive
              ? "AI coaching tips will appear here as the call progresses..."
              : "No coaching tips available."}
          </p>
        )}

        {visibleTips.map((tip) => {
          const config = tipConfig[tip.type];
          const Icon = config.icon;
          const isAnimating = animatingIds.has(tip.id);

          return (
            <div
              key={tip.id}
              className={cn(
                "relative rounded-lg border-l-4 p-3 transition-all duration-300",
                config.borderColor,
                config.bgColor,
                isAnimating ? "animate-in fade-in slide-in-from-right-4" : "opacity-100"
              )}
              style={
                isAnimating
                  ? { animation: "fadeSlideIn 0.4s ease-out forwards" }
                  : undefined
              }
            >
              <button
                onClick={() => dismiss(tip.id)}
                className="absolute top-2 right-2 p-0.5 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                aria-label="Dismiss tip"
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>

              <div className="flex items-start gap-2 pr-5">
                <Icon className={cn("size-4 mt-0.5 shrink-0", config.iconColor)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("text-[10px] font-semibold uppercase", config.iconColor)}>
                      {config.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {formatTimestamp(tip.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/90">
                    {tip.text}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateX(16px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}} />
    </div>
  );
}
