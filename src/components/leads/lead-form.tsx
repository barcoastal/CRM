"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createLeadSchema, type CreateLeadInput, LEAD_SOURCES } from "@/lib/validations/lead";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Link from "next/link";

function formatSourceLabel(source: string): string {
  return source
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

const inputClass =
  "w-full px-4 py-[11px] rounded text-sm outline-none transition-shadow focus:ring-2 focus:ring-[#3052FF]/20 focus:bg-white";
const inputStyle = { background: "#f2f3ff", border: "none", color: "#131b2e", fontFamily: "Inter, sans-serif" };

const labelClass = "text-[12.5px] font-semibold uppercase tracking-wide mb-1.5 block";
const labelStyle = { color: "#444656" };

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
    <div style={{ color: "#131b2e" }}>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/leads"
            className="flex items-center justify-center rounded"
            style={{ width: 36, height: 36, background: "#f2f3ff", color: "#131b2e" }}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1
              className="text-[26px] font-bold leading-tight"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Add New Lead
            </h1>
            <p className="text-[13.5px] mt-0.5" style={{ color: "#444656" }}>
              Enter the details for the new business lead.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/leads"
            className="px-[18px] py-[9px] rounded text-[13.5px] font-medium"
            style={{ background: "#f2f3ff", color: "#131b2e", textDecoration: "none" }}
          >
            Cancel
          </Link>
          <button
            form="lead-new-form"
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-[9px] rounded text-[13.5px] font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#0034e4,#3052ff)", border: "none", cursor: "pointer" }}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {submitting ? "Creating..." : "Create Lead"}
          </button>
        </div>
      </div>

      {serverError && (
        <div
          className="rounded-lg px-4 py-3 text-sm mb-6"
          style={{ background: "rgba(186,26,26,0.08)", color: "#ba1a1a" }}
        >
          {serverError}
        </div>
      )}

      <form id="lead-new-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Business & Contact Info */}
        <div
          className="rounded-xl p-7"
          style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <h2
            className="text-base font-bold mb-6"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Business &amp; Contact Information
          </h2>

          <div className="grid gap-x-8 gap-y-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {/* Business Name — full width */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label className={labelClass} style={labelStyle}>Business Name *</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="Acme Corp"
                {...register("businessName")}
                aria-invalid={!!errors.businessName}
              />
              {errors.businessName && (
                <p className="text-xs mt-1" style={{ color: "#ba1a1a" }}>{errors.businessName.message}</p>
              )}
            </div>

            {/* Contact Name */}
            <div>
              <label className={labelClass} style={labelStyle}>Contact Name *</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="John Smith"
                {...register("contactName")}
                aria-invalid={!!errors.contactName}
              />
              {errors.contactName && (
                <p className="text-xs mt-1" style={{ color: "#ba1a1a" }}>{errors.contactName.message}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className={labelClass} style={labelStyle}>Phone *</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="(555) 123-4567"
                {...register("phone")}
                aria-invalid={!!errors.phone}
              />
              {errors.phone && (
                <p className="text-xs mt-1" style={{ color: "#ba1a1a" }}>{errors.phone.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className={labelClass} style={labelStyle}>Email</label>
              <input
                className={inputClass}
                style={inputStyle}
                type="email"
                placeholder="john@acme.com"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs mt-1" style={{ color: "#ba1a1a" }}>{errors.email.message}</p>
              )}
            </div>

            {/* EIN */}
            <div>
              <label className={labelClass} style={labelStyle}>EIN</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="12-3456789"
                {...register("ein")}
              />
            </div>

            {/* Industry */}
            <div>
              <label className={labelClass} style={labelStyle}>Industry</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="e.g. Healthcare, Retail"
                {...register("industry")}
              />
            </div>

            {/* Annual Revenue */}
            <div>
              <label className={labelClass} style={labelStyle}>Annual Revenue</label>
              <input
                className={inputClass}
                style={inputStyle}
                type="number"
                placeholder="500000"
                {...register("annualRevenue")}
                aria-invalid={!!errors.annualRevenue}
              />
              {errors.annualRevenue && (
                <p className="text-xs mt-1" style={{ color: "#ba1a1a" }}>{errors.annualRevenue.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Lead Management */}
        <div
          className="rounded-xl p-7"
          style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <h2
            className="text-base font-bold mb-6"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Lead Management
          </h2>

          <div className="grid gap-x-8 gap-y-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {/* Estimated Debt */}
            <div>
              <label className={labelClass} style={labelStyle}>Estimated Debt</label>
              <input
                className={inputClass}
                style={inputStyle}
                type="number"
                placeholder="150000"
                {...register("totalDebtEst")}
                aria-invalid={!!errors.totalDebtEst}
              />
              {errors.totalDebtEst && (
                <p className="text-xs mt-1" style={{ color: "#ba1a1a" }}>{errors.totalDebtEst.message}</p>
              )}
            </div>

            {/* Source */}
            <div>
              <label className={labelClass} style={labelStyle}>Lead Source</label>
              <Select
                defaultValue="OTHER"
                onValueChange={(val) => setValue("source", val as CreateLeadInput["source"])}
              >
                <SelectTrigger
                  className="w-full px-4 py-[11px] h-auto text-sm rounded outline-none focus:ring-2 focus:ring-[#3052FF]/20"
                  style={{ background: "#f2f3ff", border: "none", color: "#131b2e" }}
                >
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

            {/* Notes — full width */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label className={labelClass} style={labelStyle}>Notes</label>
              <textarea
                className={inputClass}
                style={{ ...inputStyle, resize: "vertical", minHeight: 120, lineHeight: 1.6 }}
                placeholder="Any additional information about the lead..."
                rows={4}
                {...register("notes")}
              />
            </div>
          </div>
        </div>

        {/* UTM Parameters */}
        <div
          className="rounded-xl p-7"
          style={{ background: "#ffffff", boxShadow: "0 12px 40px rgba(19,27,46,0.06)" }}
        >
          <h2
            className="text-base font-bold mb-6"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            UTM Parameters &amp; Tracking
          </h2>

          <div className="grid grid-cols-3 gap-x-8 gap-y-5 mb-6">
            <div>
              <label className={labelClass} style={labelStyle}>UTM Source</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="google, facebook, etc."
                {...register("utmSource")}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>UTM Medium</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="cpc, email, social"
                {...register("utmMedium")}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>UTM Campaign</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="spring_sale"
                {...register("utmCampaign")}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>UTM Term</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="debt+settlement"
                {...register("utmTerm")}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>UTM Content</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="banner_ad_1"
                {...register("utmContent")}
              />
            </div>
          </div>

          <div
            className="pt-6 grid grid-cols-2 gap-x-8 gap-y-5"
            style={{ borderTop: "1px solid #f2f3ff" }}
          >
            <div>
              <label className={labelClass} style={labelStyle}>Google Click ID (GCLID)</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="Google Ads click ID"
                {...register("gclid")}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Facebook Click ID (FBCLID)</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="Facebook click ID"
                {...register("fbclid")}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>EliClick ID</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="EliClick tracking ID"
                {...register("eliClickId")}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>RedTrack Click ID</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="RedTrack click ID"
                {...register("redtrackClickId")}
              />
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-end gap-2.5 pb-10">
          <Link
            href="/leads"
            className="px-[18px] py-[9px] rounded text-[13.5px] font-medium"
            style={{ background: "#f2f3ff", color: "#131b2e", textDecoration: "none" }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-[9px] rounded text-[13.5px] font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#0034e4,#3052ff)", border: "none", cursor: "pointer" }}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {submitting ? "Creating..." : "Create Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
