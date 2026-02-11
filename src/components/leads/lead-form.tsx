"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createLeadSchema, type CreateLeadInput, LEAD_SOURCES } from "@/lib/validations/lead";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

function formatSourceLabel(source: string): string {
  return source
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function LeadForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema) as any,
    defaultValues: {
      source: "OTHER",
    },
  });

  const onSubmit = async (data: CreateLeadInput) => {
    setSubmitting(true);
    setServerError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setServerError(errorData.error || "Failed to create lead");
        return;
      }

      const lead = await res.json();
      router.push(`/leads/${lead.id}`);
    } catch {
      setServerError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/leads">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Add New Lead</h2>
          <p className="text-muted-foreground">
            Enter the details for the new business lead.
          </p>
        </div>
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  placeholder="Acme Corp"
                  {...register("businessName")}
                  aria-invalid={!!errors.businessName}
                />
                {errors.businessName && (
                  <p className="text-xs text-destructive">{errors.businessName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Name *</Label>
                <Input
                  id="contactName"
                  placeholder="John Smith"
                  {...register("contactName")}
                  aria-invalid={!!errors.contactName}
                />
                {errors.contactName && (
                  <p className="text-xs text-destructive">{errors.contactName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  placeholder="(555) 123-4567"
                  {...register("phone")}
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@acme.com"
                  {...register("email")}
                  aria-invalid={!!errors.email}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ein">EIN</Label>
                <Input
                  id="ein"
                  placeholder="12-3456789"
                  {...register("ein")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Business Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Business Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  placeholder="e.g. Healthcare, Retail"
                  {...register("industry")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="annualRevenue">Annual Revenue</Label>
                <Input
                  id="annualRevenue"
                  type="number"
                  placeholder="500000"
                  {...register("annualRevenue")}
                  aria-invalid={!!errors.annualRevenue}
                />
                {errors.annualRevenue && (
                  <p className="text-xs text-destructive">{errors.annualRevenue.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalDebtEst">Estimated Debt</Label>
                <Input
                  id="totalDebtEst"
                  type="number"
                  placeholder="150000"
                  {...register("totalDebtEst")}
                  aria-invalid={!!errors.totalDebtEst}
                />
                {errors.totalDebtEst && (
                  <p className="text-xs text-destructive">{errors.totalDebtEst.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Lead Source</Label>
                <Select
                  defaultValue="OTHER"
                  onValueChange={(val) => setValue("source", val as CreateLeadInput["source"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {formatSourceLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional information about the lead..."
                  rows={4}
                  {...register("notes")}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/leads">Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Creating..." : "Create Lead"}
          </Button>
        </div>
      </form>
    </div>
  );
}
