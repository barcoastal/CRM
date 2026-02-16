"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface UserOption {
  id: string;
  name: string;
}

interface OpportunityEditFormProps {
  opportunity: {
    id: string;
    totalDebt: number | null;
    expectedCloseDate: string | null;
    assignedToId: string | null;
    notes: string | null;
    lead: {
      businessName: string;
    };
  };
  users: UserOption[];
}

export function OpportunityEditForm({ opportunity, users }: OpportunityEditFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};

    const totalDebt = formData.get("totalDebt") as string;
    if (totalDebt) data.totalDebt = Number(totalDebt);
    else data.totalDebt = "";

    const expectedCloseDate = formData.get("expectedCloseDate") as string;
    data.expectedCloseDate = expectedCloseDate || "";

    const assignedToId = formData.get("assignedToId") as string;
    data.assignedToId = assignedToId || "";

    const notes = formData.get("notes") as string;
    data.notes = notes || "";

    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to update opportunity");
        return;
      }

      router.push(`/opportunities/${opportunity.id}`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const expectedCloseDateValue = opportunity.expectedCloseDate
    ? opportunity.expectedCloseDate.split("T")[0]
    : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/opportunities/${opportunity.id}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Edit Opportunity
          </h2>
          <p className="text-muted-foreground">
            {opportunity.lead.businessName}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Opportunity Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="totalDebt">Total Debt ($)</Label>
                <Input
                  id="totalDebt"
                  name="totalDebt"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={opportunity.totalDebt ?? ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
                <Input
                  id="expectedCloseDate"
                  name="expectedCloseDate"
                  type="date"
                  defaultValue={expectedCloseDateValue}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignedToId">Assigned To</Label>
                <Select
                  name="assignedToId"
                  defaultValue={opportunity.assignedToId || "NONE"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                defaultValue={opportunity.notes ?? ""}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/opportunities/${opportunity.id}`}>Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
