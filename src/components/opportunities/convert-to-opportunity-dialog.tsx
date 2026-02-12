"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ConvertToOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  businessName: string;
  totalDebtEst: number | null;
}

export function ConvertToOpportunityDialog({
  open,
  onOpenChange,
  leadId,
  businessName,
  totalDebtEst,
}: ConvertToOpportunityDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      leadId,
      estimatedValue: formData.get("estimatedValue")
        ? Number(formData.get("estimatedValue"))
        : undefined,
      expectedCloseDate: (formData.get("expectedCloseDate") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    };

    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to create opportunity");
        return;
      }

      const result = await res.json();
      onOpenChange(false);
      router.push(`/opportunities/${result.id}`);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to Opportunity</DialogTitle>
          <DialogDescription>
            Create a sales opportunity for {businessName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
            <Input
              id="estimatedValue"
              name="estimatedValue"
              type="number"
              min={0}
              step="0.01"
              defaultValue={totalDebtEst ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
            <Input
              id="expectedCloseDate"
              name="expectedCloseDate"
              type="date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Optional notes about this opportunity..."
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Converting..." : "Convert to Opportunity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
