import { prisma } from "@/lib/prisma";
import { firePostbackEvent } from "./postback";

/**
 * Allowed CRM lead columns the field mapping UI can target.
 * Anything not in this list is treated as a custom field and stuffed into
 * Lead.sfDataJson under a "marketing" namespace.
 */
export const LEAD_TARGET_FIELDS = [
  "leadName",
  "businessName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "mobilePhone",
  "street",
  "city",
  "state",
  "postalCode",
  "country",
] as const;

export type LeadTargetField = (typeof LEAD_TARGET_FIELDS)[number];

/**
 * Apply the source's fieldMapping to a raw payload to produce a mapped object
 * where keys are CRM lead field names (LEAD_TARGET_FIELDS) plus a custom bag.
 */
export function mapFields(
  raw: Record<string, unknown>,
  fieldMapping: Record<string, string>,
): { mapped: Record<string, unknown>; custom: Record<string, unknown> } {
  const mapped: Record<string, unknown> = {};
  const custom: Record<string, unknown> = {};

  // Apply explicit mappings first
  for (const [sourceKey, targetKey] of Object.entries(fieldMapping || {})) {
    if (!targetKey) continue;
    if (raw[sourceKey] === undefined) continue;
    if (targetKey.startsWith("sfDataJson.")) {
      custom[targetKey.slice("sfDataJson.".length)] = raw[sourceKey];
    } else if ((LEAD_TARGET_FIELDS as readonly string[]).includes(targetKey)) {
      mapped[targetKey] = raw[sourceKey];
    } else {
      custom[targetKey] = raw[sourceKey];
    }
  }

  // Anything in raw NOT already used by mapping passes into custom
  const usedSourceKeys = new Set(Object.keys(fieldMapping || {}));
  for (const [k, v] of Object.entries(raw)) {
    if (usedSourceKeys.has(k)) continue;
    if (custom[k] === undefined) custom[k] = v;
  }

  return { mapped, custom };
}

/**
 * Build a Lead create payload from a mapped+custom object.
 * Sets businessName/contactName fallbacks so the Lead model NOT NULLs are met.
 */
function buildLeadData(
  mapped: Record<string, unknown>,
  custom: Record<string, unknown>,
  leadSource: string,
  ownerId: string | null,
): {
  data: Record<string, unknown>;
  contactName: string;
  email: string | null;
  phone: string;
  businessName: string;
} {
  const firstName = String(mapped.firstName ?? "").trim();
  const lastName = String(mapped.lastName ?? "").trim();
  const leadName = String(mapped.leadName ?? "").trim();
  const contactName =
    leadName ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    String(mapped.email ?? "") ||
    "Unknown";
  const businessName =
    String(mapped.businessName ?? "").trim() || contactName || "Unknown";
  const phone = String(mapped.phone ?? mapped.mobilePhone ?? "").trim();
  const email = mapped.email ? String(mapped.email).trim() : null;

  // Eastern time stamp for SF parity. Format: ISO string in America/New_York.
  const nowEastern = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const sfData: Record<string, unknown> = {
    ...custom,
    Created_Date_Eastern__c: nowEastern,
    Marketing_Source_Channel__c: leadSource,
  };

  const data: Record<string, unknown> = {
    businessName,
    contactName,
    phone,
    email,
    source: "OTHER",
    status: "NEW",
    sfDataJson: JSON.stringify(sfData),
  };

  if (mapped.state) data.state = String(mapped.state);
  if (ownerId) data.assignedToId = ownerId;
  data.leadVendorId = null;

  // Marketing attribution passthrough if present in custom
  const utmFields = ["utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent"] as const;
  for (const k of utmFields) {
    if (custom[k] != null) (data as Record<string, unknown>)[k] = String(custom[k]);
  }
  const clickIds = ["gclid", "fbclid", "eliClickId", "redtrackClickId"] as const;
  for (const k of clickIds) {
    if (custom[k] != null) (data as Record<string, unknown>)[k] = String(custom[k]);
  }

  return { data, contactName, email, phone, businessName };
}

export interface ProcessInboundResult {
  status: "created" | "duplicate" | "validation_failed" | "error";
  httpStatus: number;
  body: Record<string, unknown>;
  leadId?: string;
  logId?: string;
}

/**
 * Core inbound processing. Looks up source, maps fields, validates, dedupes,
 * creates Lead, writes log, fires postback. Shared by the public webhook and
 * the internal "Send Test Payload" endpoint.
 */
export async function processInboundPayload(opts: {
  slug: string;
  apiKey: string | null;
  rawPayload: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  skipApiKeyCheck?: boolean;
}): Promise<ProcessInboundResult> {
  const source = await prisma.marketingSource.findUnique({
    where: { slug: opts.slug },
  });
  if (!source) {
    return {
      status: "error",
      httpStatus: 404,
      body: { error: "Source not found" },
    };
  }
  if (!source.isActive) {
    return {
      status: "error",
      httpStatus: 403,
      body: { error: "Source disabled" },
    };
  }
  if (!opts.skipApiKeyCheck) {
    if (!opts.apiKey || opts.apiKey !== source.apiKey) {
      return {
        status: "error",
        httpStatus: 401,
        body: { error: "Invalid API key" },
      };
    }
  }

  const fieldMapping = (source.fieldMapping as Record<string, string>) ?? {};
  const { mapped, custom } = mapFields(opts.rawPayload, fieldMapping);

  // Validate required fields
  const required = source.requiredFields ?? [];
  const missing: string[] = [];
  for (const r of required) {
    const v =
      (mapped as Record<string, unknown>)[r] ??
      (custom as Record<string, unknown>)[r];
    if (v == null || String(v).trim() === "") missing.push(r);
  }
  if (missing.length > 0) {
    const log = await prisma.marketingInboundLog.create({
      data: {
        sourceId: source.id,
        rawPayload: opts.rawPayload as never,
        parsed: { mapped, custom } as never,
        status: "validation_failed",
        errorMessage: `Missing required fields: ${missing.join(", ")}`,
        ip: opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
      },
    });
    return {
      status: "validation_failed",
      httpStatus: 400,
      body: { error: "Missing required fields", missing },
      logId: log.id,
    };
  }

  const leadSource = source.leadSource ?? source.name;
  const { data, email, phone } = buildLeadData(
    mapped,
    custom,
    leadSource,
    source.defaultOwnerId,
  );

  // Dedupe
  if (source.dedupeBy === "email" && email) {
    const existing = await prisma.lead.findFirst({
      where: { email },
      select: { id: true, businessName: true, contactName: true },
    });
    if (existing) {
      const log = await prisma.marketingInboundLog.create({
        data: {
          sourceId: source.id,
          rawPayload: opts.rawPayload as never,
          parsed: { mapped, custom } as never,
          leadId: existing.id,
          status: "duplicate",
          ip: opts.ip ?? null,
          userAgent: opts.userAgent ?? null,
        },
      });
      return {
        status: "duplicate",
        httpStatus: 200,
        body: { ok: true, duplicate: true, leadId: existing.id, leadName: existing.contactName },
        leadId: existing.id,
        logId: log.id,
      };
    }
  } else if (source.dedupeBy === "phone" && phone) {
    const existing = await prisma.lead.findFirst({
      where: { phone },
      select: { id: true, businessName: true, contactName: true },
    });
    if (existing) {
      const log = await prisma.marketingInboundLog.create({
        data: {
          sourceId: source.id,
          rawPayload: opts.rawPayload as never,
          parsed: { mapped, custom } as never,
          leadId: existing.id,
          status: "duplicate",
          ip: opts.ip ?? null,
          userAgent: opts.userAgent ?? null,
        },
      });
      return {
        status: "duplicate",
        httpStatus: 200,
        body: { ok: true, duplicate: true, leadId: existing.id, leadName: existing.contactName },
        leadId: existing.id,
        logId: log.id,
      };
    }
  }

  // Create lead
  try {
    const lead = await prisma.lead.create({ data: data as never });

    const log = await prisma.marketingInboundLog.create({
      data: {
        sourceId: source.id,
        rawPayload: opts.rawPayload as never,
        parsed: { mapped, custom } as never,
        leadId: lead.id,
        status: "created",
        ip: opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
      },
    });

    // Fire postback (fire-and-forget)
    void firePostbackEvent({
      event: "lead.created",
      entityType: "Lead",
      entityId: lead.id,
      data: { lead, source: { id: source.id, name: source.name, slug: source.slug } },
    }).catch(() => {});

    return {
      status: "created",
      httpStatus: 200,
      body: { ok: true, leadId: lead.id, leadName: lead.contactName },
      leadId: lead.id,
      logId: log.id,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const log = await prisma.marketingInboundLog
      .create({
        data: {
          sourceId: source.id,
          rawPayload: opts.rawPayload as never,
          parsed: { mapped, custom } as never,
          status: "error",
          errorMessage,
          ip: opts.ip ?? null,
          userAgent: opts.userAgent ?? null,
        },
      })
      .catch(() => null);
    return {
      status: "error",
      httpStatus: 500,
      body: { error: "Failed to create lead", details: errorMessage },
      logId: log?.id,
    };
  }
}
