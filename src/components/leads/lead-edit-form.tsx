"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/validations/lead";

interface LeadFormData {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string | null;
  ein: string | null;
  industry: string | null;
  annualRevenue: number | null;
  totalDebtEst: number | null;
  source: string;
  status: string;
  notes: string | null;
  assignedToId: string | null;
}

interface LeadEditFormProps {
  lead: LeadFormData;
}

export function LeadEditForm({ lead }: LeadEditFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    businessName: lead.businessName,
    contactName: lead.contactName,
    phone: lead.phone,
    email: lead.email ?? "",
    ein: lead.ein ?? "",
    industry: lead.industry ?? "",
    annualRevenue: lead.annualRevenue?.toString() ?? "",
    totalDebtEst: lead.totalDebtEst?.toString() ?? "",
    source: lead.source,
    status: lead.status,
    notes: lead.notes ?? "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        businessName: formData.businessName,
        contactName: formData.contactName,
        phone: formData.phone,
        email: formData.email || undefined,
        ein: formData.ein || undefined,
        industry: formData.industry || undefined,
        annualRevenue: formData.annualRevenue
          ? parseFloat(formData.annualRevenue)
          : undefined,
        totalDebtEst: formData.totalDebtEst
          ? parseFloat(formData.totalDebtEst)
          : undefined,
        source: formData.source,
        status: formData.status,
        notes: formData.notes || undefined,
      };

      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save lead");
        return;
      }

      router.push(`/leads/${lead.id}`);
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/leads/${lead.id}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">
          Edit: {lead.businessName}
        </h2>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="contactName">Contact Name *</Label>
                <Input
                  id="contactName"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ein">EIN</Label>
                <Input
                  id="ein"
                  name="ein"
                  value={formData.ein}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Business Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Business Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="annualRevenue">Annual Revenue</Label>
                <Input
                  id="annualRevenue"
                  name="annualRevenue"
                  type="number"
                  step="0.01"
                  value={formData.annualRevenue}
                  onChange={handleChange}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="totalDebtEst">Estimated Debt</Label>
                <Input
                  id="totalDebtEst"
                  name="totalDebtEst"
                  type="number"
                  step="0.01"
                  value={formData.totalDebtEst}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Lead Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Lead Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, source: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                name="notes"
                rows={5}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Add notes about this lead..."
              />
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link href={`/leads/${lead.id}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
