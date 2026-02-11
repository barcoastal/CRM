"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Check } from "lucide-react";

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
    <Card>
      <CardHeader>
        <CardTitle>Call Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Textarea
            placeholder="Add notes about this call..."
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaved(false);
            }}
            rows={4}
          />
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={isPending} size="sm">
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <Check className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {isPending ? "Saving..." : saved ? "Saved" : "Save Notes"}
            </Button>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
