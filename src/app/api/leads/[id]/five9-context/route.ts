import type { Lead } from "@/generated/prisma/client";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { canAccessRecord } from "@/lib/record-access";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { makeCtx, triggerUpdate } from "@/lib/triggers/runner";
import { validateLeadPatch } from "@/lib/validation/lead-validation";
import { NextRequest } from "next/server";
import { z } from "zod";
import { BRANDS } from "@/lib/sf-canonical";

// The Five9 form sends only changed fields. Keep this whitelist separate from
// arbitrary Salesforce snapshot keys so a caller cannot update hidden fields.
const text = z.string().max(500);
const patchSchema = z.object({
  firstName: text, lastName: text, businessName: text, email: text,
  alternateEmail: text, street: text, city: text, state: text,
  postalCode: text, phone: text, mobilePhone: text, workPhone: text,
  ein: text, industry: text, source: text, debtRange: text,
  brand: z.enum(BRANDS).nullable(),
  utmTerm: text, comments: z.string().max(5000),
  hasCalendlyEvent: z.boolean().nullable(),
  totalDebtEst: z.number().nonnegative().nullable(),
  numberOfLenders: z.number().int().nonnegative().nullable(),
}).partial().strict();

const snapshotKeys: Record<string, string[]> = {
  firstName: ["FirstName"], lastName: ["LastName"],
  businessName: ["Company"], email: ["Email"],
  alternateEmail: ["Alternate_Email__c"], street: ["Street"],
  city: ["City"], state: ["State", "StateCode"],
  postalCode: ["PostalCode"], phone: ["Phone"],
  mobilePhone: ["MobilePhone"], workPhone: ["Work_Phone__c"],
  ein: ["EIN_Number_Tax_Id__c"], industry: ["Industry"],
  source: ["LeadSource"], debtRange: ["Estimated_Total_Debt__c"],
  brand: ["Brand__c"],
  utmTerm: ["UTM_Term__c"], comments: ["pi__comments__c"],
  hasCalendlyEvent: ["Has_Calendly_Event__c"],
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const { id } = await params;
  if (!await canAccessRecord("lead", id)) return ssnSafeJson({ error: "Lead not found" }, { status: 404 });
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return ssnSafeJson({ error: "Lead not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data ?? {}).length) {
    return ssnSafeJson({ error: "Invalid lead changes" }, { status: 400 });
  }
  const patch = parsed.data;
  const currentSf: Record<string, unknown> = (() => {
    try { return JSON.parse(existing.sfDataJson ?? "{}") as Record<string, unknown>; }
    catch { return {}; }
  })();
  const sf = { ...currentSf };
  const data: Record<string, unknown> = {};
  const previousNames = existing.contactName.trim().split(/\s+/);
  const firstName = patch.firstName ?? String(currentSf.FirstName ?? (previousNames.length > 1 ? previousNames[0] : ""));
  const lastName = patch.lastName ?? String(currentSf.LastName ?? (previousNames.length > 1 ? previousNames.slice(1).join(" ") : previousNames[0] ?? ""));
  if (patch.firstName !== undefined || patch.lastName !== undefined) {
    const contactName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!contactName) return ssnSafeJson({ error: "First or last name is required" }, { status: 400 });
    data.contactName = contactName;
  }
  if (patch.businessName !== undefined) {
    if (!patch.businessName.trim()) return ssnSafeJson({ error: "Company is required" }, { status: 400 });
    data.businessName = patch.businessName.trim();
  }
  if (patch.phone !== undefined) {
    if (patch.phone.replace(/\D/g, "").length < 7) return ssnSafeJson({ error: "Enter a valid phone number" }, { status: 400 });
    data.phone = patch.phone.trim();
  }
  if (patch.email !== undefined) {
    if (patch.email.trim() && !z.email().safeParse(patch.email.trim()).success) {
      return ssnSafeJson({ error: "Enter a valid email address" }, { status: 400 });
    }
    data.email = patch.email.trim() || null;
  }
  if (patch.ein !== undefined) data.ein = patch.ein.trim() || null;
  if (patch.industry !== undefined) data.industry = patch.industry.trim() || null;
  if (patch.state !== undefined) data.state = patch.state.trim() || null;
  if (patch.utmTerm !== undefined) data.utmTerm = patch.utmTerm.trim() || null;
  if (patch.source !== undefined) data.source = patch.source.trim() || "OTHER";
  if (patch.brand !== undefined) data.brand = patch.brand;
  if (patch.totalDebtEst !== undefined) data.totalDebtEst = patch.totalDebtEst;
  if (patch.numberOfLenders !== undefined) data.numberOfLenders = patch.numberOfLenders;

  for (const [field, keys] of Object.entries(snapshotKeys)) {
    if (!(field in patch)) continue;
    let value = patch[field as keyof typeof patch];
    if (field === "source") value = data.source as string;
    if (typeof value === "string") value = value.trim() || null;
    for (const key of keys) sf[key] = value;
  }
  if (Object.keys(patch).some(field => field in snapshotKeys)) data.sfDataJson = JSON.stringify(sf);

  const vErrors = validateLeadPatch({
    id: existing.id, status: existing.status, email: existing.email,
    phone: existing.phone, contactName: existing.contactName,
    businessName: existing.businessName,
  }, {
    email: data.email as string | undefined,
    phone: data.phone as string | undefined,
    contactName: data.contactName as string | undefined,
    businessName: data.businessName as string | undefined,
  });
  if (vErrors.length) return ssnSafeJson({ error: vErrors[0] }, { status: 400 });

  try {
    const lead = await triggerUpdate<Lead>("lead", id, data, makeCtx(r.session.userId));
    await auditWrite({
      userId: r.session.userId, entity: "Lead", entityId: id, action: "UPDATE",
      before: Object.fromEntries(Object.keys(patch).map(key => [key, key in existing ? (existing as unknown as Record<string, unknown>)[key] : currentSf[snapshotKeys[key]?.[0]]])),
      after: patch,
    }).catch(error => { console.error("[leads/five9-context] audit write failed:", error); });
    return ssnSafeJson({ ok: true, id: lead.id });
  } catch (error) {
    return ssnSafeJson({ error: error instanceof Error ? error.message : "Could not save lead" }, { status: 400 });
  }
}
