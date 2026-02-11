"use client";

import { cn } from "@/lib/utils";

interface SessionStatsProps {
  stats: {
    callsMade: number;
    connected: number;
    noAnswer: number;
    voicemail: number;
    busy: number;
    enrolled: number;
    totalTalkTime: number;
  };
  className?: string;
}

function formatTalkTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SessionStats({ stats, className }: SessionStatsProps) {
  const items = [
    { label: "Calls Made", value: stats.callsMade, color: "text-foreground" },
    { label: "Connected", value: stats.connected, color: "text-green-600" },
    { label: "No Answer", value: stats.noAnswer, color: "text-yellow-600" },
    { label: "Voicemail", value: stats.voicemail, color: "text-orange-600" },
    { label: "Busy", value: stats.busy, color: "text-red-600" },
    { label: "Enrolled", value: stats.enrolled, color: "text-emerald-600" },
    {
      label: "Talk Time",
      value: formatTalkTime(stats.totalTalkTime),
      color: "text-blue-600",
    },
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-4 py-3",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <span className={cn("text-sm font-semibold tabular-nums", item.color)}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
