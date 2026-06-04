/**
 * Public web-form → Lead endpoint.
 * Port of SF WebLeadsRestService (docs/sf-export/sfdx-raw/classes/WebLeadsRestService.cls)
 *
 * Accepts EITHER POST form data, POST JSON, or GET query params:
 *   first_name, last_name, email, phone_number, state, lead_source,
 *   vendor_id, ad_id, campaign_name, has_multiple_mca, estimated_total_debt
 *
 * Auth: none (public — should be rate-limited and/or HMAC-signed when wired
 * to specific vendors). The endpoint is idempotent on (phone_number,
 * lead_source) per the existing SF dedupe rules.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeCtx, triggerCreate } from "@/lib/triggers/runner";
import type { Lead } from "@/generated/prisma/client";

const VALID_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

function isValidEmail(v: string | null | undefined): boolean {
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function handle(params: Record<string, string | null | undefined>) {
  if (Object.keys(params).length === 0) {
    return NextResponse.json({ ok: false, message: "No request params found." }, { status: 400 });
  }

  const firstName = params.first_name ?? params.firstName ?? "";
  const lastName = params.last_name ?? params.lastName ?? `--No Data-- ${Date.now()}`;
  const email = params.email ?? null;
  const phone = params.phone_number ?? params.phone ?? "";
  const state = params.state ?? null;
  const leadSource = params.lead_source ?? params.leadSource ?? "Webform";
  const vendorId = params.vendor_id ?? params.vendorId ?? null;
  const adId = params.ad_id ?? params.adId ?? null;
  const campaignName = params.campaign_name ?? params.campaignName ?? null;
  const hasMultipleMcaRaw = (params.has_multiple_mca ?? params.hasMultipleMca ?? "").toString().toLowerCase();
  const hasMultipleMca = hasMultipleMcaRaw === "true" ? true : hasMultipleMcaRaw === "false" ? false : null;
  const estDebtRaw = params.estimated_total_debt ?? params.estimatedTotalDebt ?? "";
  const estDebt = estDebtRaw ? parseFloat(estDebtRaw.replace(/[^0-9.]/g, "")) : null;

  const errors: string[] = [];
  if (email && !isValidEmail(email)) {
    errors.push(`Email is not in valid format, email received is ${email}.`);
  }
  if (state) {
    const upper = state.toUpperCase();
    if (state.length === 2 && !VALID_STATES.has(upper)) {
      errors.push(`State is not valid, state value received is ${state}.`);
    }
  }
  if (!phone) {
    return NextResponse.json({ ok: false, message: "phone_number is required" }, { status: 400 });
  }

  // Normalize phone to digits — last 10 = match key for dedupe
  const phoneDigits = phone.replace(/[^0-9]/g, "");
  const phoneKey = phoneDigits.startsWith("1") && phoneDigits.length === 11
    ? phoneDigits.slice(1)
    : phoneDigits;

  // Dedupe by phone + leadSource
  const existing = await prisma.lead.findFirst({
    where: {
      phone: { contains: phoneKey },
      source: leadSource,
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({
      ok: true,
      message: "Duplicate Lead Exists",
      leadId: existing.id,
      duplicate: true,
    });
  }

  const ctx = makeCtx(null);
  const lead = await triggerCreate<Lead>("lead", {
    recordType: "WEB",
    businessName: campaignName ?? (`${firstName} ${lastName}`.trim() || "Web Lead"),
    contactName: `${firstName} ${lastName}`.trim() || "Unknown",
    phone,
    email: email && isValidEmail(email) ? email : null,
    source: leadSource,
    leadVendorId: vendorId,
    adId,
    campaignName,
    hasMultipleMca,
    state: state && state.length === 2 ? state.toUpperCase() : state,
    totalDebtEst: typeof estDebt === "number" && Number.isFinite(estDebt) ? estDebt : null,
  }, ctx);

  return NextResponse.json({
    ok: true,
    message: errors.length ? `Sync to CRM Successful — warnings: ${errors.join(" ")}` : "Sync to CRM Successful",
    leadId: lead.id,
    warnings: errors,
  });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let params: Record<string, string | null | undefined> = {};

  if (contentType.includes("application/json")) {
    params = (await request.json().catch(() => ({}))) as Record<string, string>;
  } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    for (const [k, v] of form.entries()) params[k] = typeof v === "string" ? v : null;
  } else {
    // Fall back to query params
    const url = new URL(request.url);
    for (const [k, v] of url.searchParams.entries()) params[k] = v;
  }

  return handle(params);
}

export async function GET(request: NextRequest) {
  // SF also supported GET for vendor convenience
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) params[k] = v;
  return handle(params);
}
