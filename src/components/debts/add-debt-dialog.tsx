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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AddDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
  opportunityId?: string;
  onSuccess: () => void;
}

export function AddDebtDialog({
  open,
  onOpenChange,
  clientId,
  opportunityId,
  onSuccess,
}: AddDebtDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      creditorName: formData.get("creditorName") as string,
      creditorPhone: formData.get("creditorPhone") as string,
      creditorEmail: formData.get("creditorEmail") as string,
      accountNumber: formData.get("accountNumber") as string,
      originalBalance: Number(formData.get("originalBalance")),
      currentBalance: Number(formData.get("currentBalance")),
      enrolledBalance: Number(formData.get("enrolledBalance")),
      notes: formData.get("notes") as string,
    };

    try {
      const apiUrl = opportunityId
        ? `/api/opportunities/${opportunityId}/debts`
        : `/api/clients/${clientId}/debts`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to add debt");
        return;
      }

      onOpenChange(false);
      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Debt</DialogTitle>
          <DialogDescription>
            Add a new creditor account to this client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="creditorName">Creditor Name *</Label>
              <Input id="creditorName" name="creditorName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditorPhone">Creditor Phone</Label>
              <Input id="creditorPhone" name="creditorPhone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditorEmail">Creditor Email</Label>
              <Input id="creditorEmail" name="creditorEmail" type="email" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input id="accountNumber" name="accountNumber" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="originalBalance">Original Balance ($) *</Label>
              <Input
                id="originalBalance"
                name="originalBalance"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentBalance">Current Balance ($) *</Label>
              <Input
                id="currentBalance"
                name="currentBalance"
                type="number"
                step="0.01"
                min="0"
                required
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="enrolledBalance">Enrolled Balance ($) *</Label>
              <Input
                id="enrolledBalance"
                name="enrolledBalance"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="debt-notes">Notes</Label>
              <Textarea id="debt-notes" name="notes" rows={2} />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Debt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
