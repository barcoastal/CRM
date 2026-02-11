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

interface EnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  businessName: string;
  totalDebtEst: number | null;
}

export function EnrollmentDialog({
  open,
  onOpenChange,
  leadId,
  businessName,
  totalDebtEst,
}: EnrollmentDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      status: "ENROLLED",
      enrollmentData: {
        programStartDate: formData.get("programStartDate") as string,
        programLength: Number(formData.get("programLength")),
        monthlyPayment: Number(formData.get("monthlyPayment")),
        totalEnrolledDebt: Number(formData.get("totalEnrolledDebt")),
      },
    };

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to enroll client");
        return;
      }

      const result = await res.json();
      onOpenChange(false);
      if (result.clientId) {
        router.push(`/clients/${result.clientId}`);
      } else {
        router.refresh();
      }
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
          <DialogTitle>Enroll Client</DialogTitle>
          <DialogDescription>
            Enroll {businessName} into the debt settlement program.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="programStartDate">Program Start Date</Label>
            <Input
              id="programStartDate"
              name="programStartDate"
              type="date"
              defaultValue={today}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="programLength">Program Length (months)</Label>
            <Input
              id="programLength"
              name="programLength"
              type="number"
              min={1}
              max={60}
              defaultValue={24}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyPayment">Monthly Payment ($)</Label>
            <Input
              id="monthlyPayment"
              name="monthlyPayment"
              type="number"
              min={1}
              step="0.01"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalEnrolledDebt">Total Enrolled Debt ($)</Label>
            <Input
              id="totalEnrolledDebt"
              name="totalEnrolledDebt"
              type="number"
              min={1}
              step="0.01"
              defaultValue={totalDebtEst ?? ""}
              required
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
              {submitting ? "Enrolling..." : "Enroll Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
