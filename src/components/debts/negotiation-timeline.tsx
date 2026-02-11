"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Mail, FileText, Send, Plus } from "lucide-react";
import { NEGOTIATION_TYPES, NEGOTIATION_RESPONSES } from "@/lib/validations/debt";

interface NegotiationData {
  id: string;
  type: string;
  date: string;
  offerAmount: number | null;
  offerPercent: number | null;
  response: string;
  counterAmount: number | null;
  notes: string | null;
  negotiator: { id: string; name: string };
  createdAt: string;
}

interface NegotiationTimelineProps {
  negotiations: NegotiationData[];
  clientId: string;
  debtId: string;
  onRefresh: () => void;
}

const TYPE_ICONS: Record<string, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  LETTER: FileText,
  FAX: Send,
};

const RESPONSE_COLORS: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  ACCEPTED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  COUNTERED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function NegotiationTimeline({
  negotiations,
  clientId,
  debtId,
  onRefresh,
}: NegotiationTimelineProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      type: formData.get("type") as string,
      date: formData.get("date") as string,
      offerAmount: formData.get("offerAmount") ? Number(formData.get("offerAmount")) : null,
      offerPercent: formData.get("offerPercent") ? Number(formData.get("offerPercent")) : null,
      response: formData.get("response") as string,
      counterAmount: formData.get("counterAmount") ? Number(formData.get("counterAmount")) : null,
      notes: formData.get("notes") as string,
    };

    try {
      const res = await fetch(
        `/api/clients/${clientId}/debts/${debtId}/negotiations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (res.ok) {
        setShowForm(false);
        onRefresh();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Negotiation History</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="size-3.5" />
          Add Negotiation
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-md border p-4 space-y-3 bg-muted/30"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="neg-type" className="text-xs">Type</Label>
              <Select name="type" defaultValue="CALL">
                <SelectTrigger id="neg-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEGOTIATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="neg-date" className="text-xs">Date</Label>
              <Input id="neg-date" name="date" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="neg-offer" className="text-xs">Offer Amount ($)</Label>
              <Input id="neg-offer" name="offerAmount" type="number" step="0.01" min="0" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="neg-percent" className="text-xs">Offer %</Label>
              <Input id="neg-percent" name="offerPercent" type="number" step="0.1" min="0" max="100" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="neg-response" className="text-xs">Response</Label>
              <Select name="response" defaultValue="PENDING">
                <SelectTrigger id="neg-response">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEGOTIATION_RESPONSES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="neg-counter" className="text-xs">Counter Amount ($)</Label>
              <Input id="neg-counter" name="counterAmount" type="number" step="0.01" min="0" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="neg-notes" className="text-xs">Notes</Label>
            <Textarea id="neg-notes" name="notes" rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      )}

      {negotiations.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No negotiations recorded yet.
        </p>
      ) : (
        <div className="space-y-3">
          {negotiations.map((neg) => {
            const Icon = TYPE_ICONS[neg.type] || FileText;
            return (
              <div key={neg.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 w-px bg-border" />
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{neg.type}</span>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${RESPONSE_COLORS[neg.response] || ""}`}
                      >
                        {neg.response}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(neg.date)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    by {neg.negotiator.name}
                  </p>
                  <div className="mt-1 flex gap-4 text-sm">
                    {neg.offerAmount !== null && (
                      <span>Offer: {formatCurrency(neg.offerAmount)}</span>
                    )}
                    {neg.offerPercent !== null && (
                      <span>({neg.offerPercent}%)</span>
                    )}
                    {neg.counterAmount !== null && (
                      <span className="text-orange-600">
                        Counter: {formatCurrency(neg.counterAmount)}
                      </span>
                    )}
                  </div>
                  {neg.notes && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {neg.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
