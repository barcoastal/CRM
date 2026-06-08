"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight } from "@/components/icons/lucide";
import { OPPORTUNITY_RECORD_TYPES } from "@/lib/record-types";

interface ConvertLeadButtonProps {
  leadId: string;
  converted?: {
    accountId: string;
    contactId: string;
    opportunityId: string | null;
  };
}

const PRODUCT_LABEL: Record<string, string> = {
  DEBT_SETTLEMENT: "Debt Settlement",
  BUYOUT: "Buyout",
  RESTRUCTURE: "Restructure",
  LIMITED_ASSET_PROTECTION: "Limited Asset Protection",
};

export function ConvertLeadButton({ leadId, converted }: ConvertLeadButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<string>("DEBT_SETTLEMENT");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (converted) {
    return (
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
        <div className="text-[13px] text-emerald-900 flex-1">
          <span className="font-semibold">Converted.</span>{" "}
          <Link href={`/accounts/${converted.accountId}`} className="underline hover:no-underline">View account</Link>
          {converted.opportunityId && (
            <>
              {" · "}
              <Link href={`/opportunities/${converted.opportunityId}`} className="underline hover:no-underline">View opportunity</Link>
            </>
          )}
        </div>
      </div>
    );
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opportunityRecordType: product }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Conversion failed");
      // Navigate to the new account
      router.push(`/accounts/${body.accountId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
      setSubmitting(false);
    }
  }

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white rounded-md"
          style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
        >
          <ArrowRight className="size-4" />
          Convert to Account + Opportunity
        </button>
      ) : (
        <div className="rounded-lg bg-white border border-zinc-200 p-4 max-w-xl">
          <h3 className="font-semibold text-[14px] mb-3">Convert lead</h3>
          <label className="text-[12px] text-zinc-600 mb-1 block">Product / opportunity type</label>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 rounded-md text-[13px] mb-3"
          >
            {OPPORTUNITY_RECORD_TYPES.map((rt) => (
              <option key={rt} value={rt}>{PRODUCT_LABEL[rt]}</option>
            ))}
          </select>
          {error && <p className="text-[12px] text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 text-[13px] font-semibold text-white rounded-md disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0034e4, #3052ff)" }}
            >
              {submitting ? "Converting…" : "Convert"}
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="px-4 py-2 text-[13px] font-medium text-zinc-700 border border-zinc-200 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
