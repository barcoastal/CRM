"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Sparkles, Calendar, X, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface CallFollowUpCardProps {
  callId: string;
  disposition: string;
  leadName: string;
  businessName: string;
}

interface Recommendations {
  suggestedAction: string;
  followUpDate: string | null;
  draftMessage: string;
  autoNotes: string;
}

export function CallFollowUpCard({
  callId,
  disposition,
  leadName,
  businessName,
}: CallFollowUpCardProps) {
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const res = await fetch("/api/ai/call-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId }),
        });
        if (res.ok) {
          const data: Recommendations = await res.json();
          setRecommendations(data);
          setDraftMessage(data.draftMessage);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, [callId]);

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await fetch("/api/ai/call-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, apply: true }),
      });
      if (res.ok) {
        setApplied(true);
      }
    } finally {
      setApplying(false);
    }
  };

  if (dismissed) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            AI is analyzing the call...
          </span>
        </CardContent>
      </Card>
    );
  }

  if (!recommendations) return null;

  if (applied) {
    return (
      <Card className="border-green-200 dark:border-green-800">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex items-center justify-center size-8 rounded-full bg-green-100 dark:bg-green-900/30">
            <Check className="size-4 text-green-700 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium">Recommendations applied</p>
            <p className="text-xs text-muted-foreground">
              Follow-up date and notes have been saved to the lead record.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <CardTitle className="text-base">AI Follow-Up Recommendations</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setDismissed(true)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Suggested Action */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Suggested Action
          </p>
          <p className="text-sm font-semibold">{recommendations.suggestedAction}</p>
        </div>

        {/* Disposition & Follow-up Date */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="secondary">{disposition.replace(/_/g, " ")}</Badge>
          {recommendations.followUpDate && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3" />
              Follow up:{" "}
              {format(new Date(recommendations.followUpDate), "MMM d, yyyy 'at' h:mm a")}
            </span>
          )}
        </div>

        {/* Lead context */}
        <p className="text-xs text-muted-foreground">
          {leadName} at {businessName}
        </p>

        {/* Draft Message */}
        {draftMessage && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Draft Follow-Up Message
            </p>
            <Textarea
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>
        )}

        {/* AI Notes Preview */}
        {recommendations.autoNotes && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              AI-Enhanced Notes
            </p>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 whitespace-pre-wrap">
              {recommendations.autoNotes}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handleApply}
            disabled={applying}
          >
            {applying && <Loader2 className="size-3.5 animate-spin" />}
            Apply Recommendations
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
