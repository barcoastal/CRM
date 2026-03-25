"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, Save } from "lucide-react";

interface CallNotesProps {
  callId: string;
  initialNotes: string;
}

export function CallNotes({ callId, initialNotes }: CallNotesProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/calls/${callId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to save notes");
          return;
        }

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        setError("Failed to save notes");
      }
    });
  };

  return (
    <div className="space-y-3">
      <textarea
        placeholder="Add notes about this call..."
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        rows={4}
        className="w-full min-h-[90px] border-none bg-[#f2f3ff] rounded-lg px-3.5 py-3 font-[inherit] text-[13px] text-[#131b2e] placeholder:text-[#444656] resize-y outline-none focus:ring-1 focus:ring-[#3052ff]"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-[13px] font-medium text-white gradient-primary hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : saved ? (
            <Check className="size-3.5" />
          ) : (
            <Save className="size-3.5" />
          )}
          {isPending ? "Saving..." : saved ? "Saved" : "Save Notes"}
        </button>
        {error && <p className="text-[13px] text-red-500">{error}</p>}
      </div>
    </div>
  );
}
