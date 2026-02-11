"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface CallTimerProps {
  isActive: boolean;
  onTick?: (seconds: number) => void;
}

export function CallTimer({ isActive, onTick }: CallTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive) {
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          onTick?.(next);
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setElapsed(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, onTick]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const display = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "size-2.5 rounded-full",
          isActive ? "bg-green-500 animate-pulse" : "bg-muted"
        )}
      />
      <span
        className={cn(
          "font-mono text-2xl font-bold tabular-nums",
          isActive ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {display}
      </span>
    </div>
  );
}
