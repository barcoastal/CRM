"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  paymentId: string | null;
  onSuccess: () => void;
}

const PAYMENT_TYPE_OPTIONS = [
  { value: "CLIENT_PAYMENT", label: "Program Payment" },
  { value: "SETTLEMENT_PAYOUT", label: "Settlement Payout" },
  { value: "FEE", label: "Fee" },
] as const;

export function RecordPaymentDialog({
  open,
  onOpenChange,
  clientId,
  paymentId,
  onSuccess,
}: RecordPaymentDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMarkPaidMode = paymentId !== null;

  const today = new Date().toISOString().split("T")[0];

  async function handleMarkPaid() {
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/clients/${clientId}/payments/${paymentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "COMPLETED",
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to mark payment as paid");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecordNew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);

    const payload = {
      type: formData.get("type") as string,
      amount: Number(formData.get("amount")),
      scheduledDate: formData.get("scheduledDate") as string,
      status: "COMPLETED" as const,
      reference: (formData.get("reference") as string) || "",
      notes: (formData.get("notes") as string) || "",
    };

    try {
      const res = await fetch(`/api/clients/${clientId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to record payment");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  // Reset error when dialog opens/closes
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setError(null);
    }
    onOpenChange(isOpen);
  }

  if (isMarkPaidMode) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Payment as Paid</DialogTitle>
            <DialogDescription>
              This will mark the scheduled payment as completed with today&apos;s
              date as the paid date.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} disabled={submitting}>
              {submitting ? "Updating..." : "Mark as Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record New Payment</DialogTitle>
          <DialogDescription>
            Record a new payment for this client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleRecordNew} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Payment Type</Label>
            <Select name="type" defaultValue="CLIENT_PAYMENT" required>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={0.01}
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduledDate">Date</Label>
            <Input
              id="scheduledDate"
              name="scheduledDate"
              type="date"
              defaultValue={today}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference (optional)</Label>
            <Input
              id="reference"
              name="reference"
              type="text"
              placeholder="Check #, transaction ID, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Add any notes about this payment..."
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
