"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  eliClickId: string | null;
  redtrackClickId: string | null;
  gclid: string | null;
  fbclid: string | null;
}

interface LeadEditFormProps {
  lead: LeadFormData;
}

const inputClass =
  "w-full px-4 py-[11px] rounded text-sm outline-none transition-shadow focus:ring-2 focus:ring-[#3052FF]/20 focus:bg-white";
const inputStyle = { background: "#f2f3ff", border: "none", color: "#131b2e", fontFamily: "Inter, sans-serif" };

const labelClass = "text-[12.5px] font-semibold uppercase tracking-wide mb-1.5 block";
const labelStyle = { color: "#444656" };

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
    utmSource: lead.utmSource ?? "",
    utmMedium: lead.utmMedium ?? "",
    utmCampaign: lead.utmCampaign ?? "",
    utmTerm: lead.utmTerm ?? "",
    utmContent: lead.utmContent ?? "",
    eliClickId: lead.eliClickId ?? "",
    redtrackClickId: lead.redtrackClickId ?? "",
    gclid: lead.gclid ?? "",
    fbclid: lead.fbclid ?? "",
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
        utmSource: formData.utmSource || undefined,
        utmMedium: formData.utmMedium || undefined,
        utmCampaign: formData.utmCampaign || undefined,
        utmTerm: formData.utmTerm || undefined,
        utmContent: formData.utmContent || undefined,
        eliClickId: formData.eliClickId || undefined,
        redtrackClickId: formData.redtrackClickId || undefined,
        gclid: formData.gclid || undefined,
        fbclid: formData.fbclid || undefined,
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
    <div style={{ color: "#131b2e" }}>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-5 text-[13px]" style={{ color: "#444656" }}>
        <Link href="/leads" className="font-medium hover:underline" style={{ color: "#3052FF" }}>
          Leads
        </Link>
        <ChevronRight className="size-3.5" />
        <Link href={`/leads/${lead.id}`} className="font-medium hover:underline" style={{ color: "#3052FF" }}>
          {lead.businessName}
        </Link>
        <ChevronRight className="size-3.5" />
        <span>Edit</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <h1
          className="text-[26px] font-bold"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Edit Lead
        </h1>
        <div className="flex items-center gap-2.5">
          <Link
            href={`/leads/${lead.id}`}
            className="px-[18px] py-[9px] rounded text-[13.5px] font-medium transition-colors"
            style={{ background: "#f2f3ff", color: "#131b2e", textDecoration: "none" }}
          >
            Cancel
          </Link>
          <button
            form="lead-edit-form"
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-[9px] rounded text-[13.5px] font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#0034e4,#3052ff)", border: "none", cursor: "pointer" }}
          >
            <Check className="size-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm mb-6"
          style={{ background: "rgba(186,26,26,0.08)", color: "#ba1a1a" }}
        >
          {error}
        </div>
      )}

      <form id="lead-edit-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
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
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                required
              />
            </div>

            {/* First Name (derived from contactName — left half) */}
            <div>
              <label className={labelClass} style={labelStyle}>Contact Name *</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="contactName"
                value={formData.contactName}
                onChange={handleChange}
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label className={labelClass} style={labelStyle}>Phone *</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className={labelClass} style={labelStyle}>Email</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            {/* EIN */}
            <div>
              <label className={labelClass} style={labelStyle}>EIN</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="ein"
                value={formData.ein}
                onChange={handleChange}
                placeholder="12-3456789"
              />
            </div>

            {/* Industry */}
            <div>
              <label className={labelClass} style={labelStyle}>Industry</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                placeholder="e.g. Construction, Healthcare"
              />
            </div>

            {/* Annual Revenue */}
            <div>
              <label className={labelClass} style={labelStyle}>Annual Revenue</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="annualRevenue"
                type="number"
                step="0.01"
                value={formData.annualRevenue}
                onChange={handleChange}
                placeholder="1500000"
              />
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
                name="totalDebtEst"
                type="number"
                step="0.01"
                value={formData.totalDebtEst}
                onChange={handleChange}
                placeholder="285000"
              />
            </div>

            {/* Source */}
            <div>
              <label className={labelClass} style={labelStyle}>Source</label>
              <Select
                value={formData.source}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, source: value }))
                }
              >
                <SelectTrigger
                  className="w-full px-4 py-[11px] h-auto text-sm rounded outline-none focus:ring-2 focus:ring-[#3052FF]/20"
                  style={{ background: "#f2f3ff", border: "none", color: "#131b2e" }}
                >
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

            {/* Status */}
            <div>
              <label className={labelClass} style={labelStyle}>Status</label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger
                  className="w-full px-4 py-[11px] h-auto text-sm rounded outline-none focus:ring-2 focus:ring-[#3052FF]/20"
                  style={{ background: "#f2f3ff", border: "none", color: "#131b2e" }}
                >
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

            {/* Notes — full width */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label className={labelClass} style={labelStyle}>Notes</label>
              <textarea
                className={inputClass}
                style={{ ...inputStyle, resize: "vertical", minHeight: 120, lineHeight: 1.6 }}
                name="notes"
                rows={5}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Add notes about this lead..."
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
                name="utmSource"
                value={formData.utmSource}
                onChange={handleChange}
                placeholder="google, facebook, etc."
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>UTM Medium</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="utmMedium"
                value={formData.utmMedium}
                onChange={handleChange}
                placeholder="cpc, email, social"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>UTM Campaign</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="utmCampaign"
                value={formData.utmCampaign}
                onChange={handleChange}
                placeholder="spring_sale"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>UTM Term</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="utmTerm"
                value={formData.utmTerm}
                onChange={handleChange}
                placeholder="debt+settlement"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>UTM Content</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="utmContent"
                value={formData.utmContent}
                onChange={handleChange}
                placeholder="banner_ad_1"
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
                name="gclid"
                value={formData.gclid}
                onChange={handleChange}
                placeholder="Google Ads click ID"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Facebook Click ID (FBCLID)</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="fbclid"
                value={formData.fbclid}
                onChange={handleChange}
                placeholder="Facebook click ID"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>EliClick ID</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="eliClickId"
                value={formData.eliClickId}
                onChange={handleChange}
                placeholder="EliClick tracking ID"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>RedTrack Click ID</label>
              <input
                className={inputClass}
                style={inputStyle}
                name="redtrackClickId"
                value={formData.redtrackClickId}
                onChange={handleChange}
                placeholder="RedTrack click ID"
              />
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-end gap-2.5 pb-10">
          <Link
            href={`/leads/${lead.id}`}
            className="px-[18px] py-[9px] rounded text-[13.5px] font-medium"
            style={{ background: "#f2f3ff", color: "#131b2e", textDecoration: "none" }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-[9px] rounded text-[13.5px] font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#0034e4,#3052ff)", border: "none", cursor: "pointer" }}
          >
            <Check className="size-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
