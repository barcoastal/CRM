"use client";

import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

interface LiveTranscriptProps {
  entries: TranscriptEntry[];
  isActive: boolean;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function LiveTranscript({ entries, isActive }: LiveTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-sm font-semibold">Live Transcript</h3>
        {isActive && (
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-green-500" />
            </span>
            Live
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {isActive
              ? "Waiting for conversation to begin..."
              : "No transcript available."}
          </p>
        )}

        {entries.map((entry, index) => {
          const isAgent = entry.speaker === "agent";
          const isLatest = index === entries.length - 1 && isActive;

          return (
            <div
              key={`${entry.timestamp}-${index}`}
              className={cn(
                "flex flex-col gap-1 max-w-[85%]",
                isAgent ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatTimestamp(entry.timestamp)}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                  {isAgent ? "Agent" : "Lead"}
                </span>
              </div>
              <div
                className={cn(
                  "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  isAgent
                    ? "bg-blue-500 text-white rounded-br-md"
                    : "bg-gray-100 text-gray-900 rounded-bl-md dark:bg-gray-800 dark:text-gray-100"
                )}
              >
                {entry.text}
              </div>
              {isLatest && (
                <div className="flex items-center gap-1 px-2">
                  <span
                    className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
