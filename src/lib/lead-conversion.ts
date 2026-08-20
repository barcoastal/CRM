import { prisma } from "@/lib/prisma";
import {
  defaultAccountRecordTypeForLead,
  isAccountRecordType,
  isOpportunityRecordType,
  type AccountRecordType,
  type OpportunityRecordType,
} from "@/lib/record-types";
import { auditWrite } from "@/lib/audit";
import { firePostbackEvent } from "@/lib/marketing/postback";

export interface ConvertLeadOptions {
  /** Override account record type — defaults are inferred from lead. */
  accountRecordType?: AccountRecordType;
  /** Opportunity record type — required unless doNotCreateOpportunity */
  opportunityRecordType?: OpportunityRecordType;
  /** Optional custom opportunity name; defaults to "{Account} — {Product}" */
  opportunityName?: string;
  /** Owner for the newly-created Account + Opp */
  accountOwnerId?: string;
  /** Role string for the AccountContactRelation */
  contactRole?: string;
  /** Skip creating an opportunity */
  doNotCreateOpportunity?: boolean;
  /** ID of the user performing the conversion (for audit log) */
  performedById?: string;
  /** Skip the SF "Company + Debt + Fronter transfer" validation. Reserved for
   *  test harnesses and trigger-driven conversions. */
  skipValidation?: boolean;
  /** Salutation / first / middle / last / suffix from the modal — overrides
   *  the parsed contact name */
  contactSalutation?: string;
  contactFirstName?: string;
  contactMiddleName?: string;
  contactLastName?: string;
  contactSuffix?: string;
  /** Optional explicit account / contact / opportunity overrides from the
   *  modal (e.g. "Choose Existing Account" picker results) */
  existingAccountId?: string;
  existingContactId?: string;
  existingOpportunityId?: string;
  /** SF "Converted Status" — defaults to "Converted" */
  convertedStatus?: string;
}

export interface ConvertLeadResult {
  accountId: string;
  contactId: string;
  opportunityId: string | null;
  alreadyConverted: boolean;
}

/**
 * Pure helper: split a contactName string into first + last.
 * "Bob Johnson" → { firstName: "Bob", lastName: "Johnson" }
 * "Cher"        → { firstName: "Cher", lastName: "" }
 * "Bar Elezra Smith" → { firstName: "Bar", lastName: "Elezra Smith" }
 */
export function splitContactName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { firstName: trimmed, lastName: "" };
  return { firstName: trimmed.slice(0, idx), lastName: trimmed.slice(idx + 1).trim() };
}

/**
 * Pure helper: derive the opportunity name when none is supplied.
 */
export function defaultOpportunityName(accountName: string, recordType: OpportunityRecordType): string {
  const productLabel: Record<OpportunityRecordType, string> = {
    DEBT_SETTLEMENT: "Debt Settlement",
    BUYOUT: "Buyout",
    RESTRUCTURE: "Restructure",
    LIMITED_ASSET_PROTECTION: "Limited Asset Protection",
  };
  return `${accountName} — ${productLabel[recordType]}`;
}

/**
 * Convert a Lead into Account + Contact (+ optional Opportunity).
 * Idempotent: re-running on an already-converted lead returns the existing IDs.
 */
export async function convertLead(
  leadId: string,
  opts: ConvertLeadOptions = {},
): Promise<ConvertLeadResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { debts: true, calls: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  // Already converted? Return the existing IDs idempotently.
  if (lead.convertedAccountId && lead.convertedContactId) {
    return {
      accountId: lead.convertedAccountId,
      contactId: lead.convertedContactId,
      opportunityId: lead.convertedOpportunityId ?? null,
      alreadyConverted: true,
    };
  }

  // Conversion requires Company + Debt Information. (SF also gated on the call
  // being transferred from a fronter, but the CRM is not the dialer and never
  // has Five9 call/transfer data, so enforcing that here blocked every
  // conversion. The fronter-transfer gate lives in the dialer, not here.)
  // - Company = Lead.businessName populated
  // - Debt Information = at least one LeadDebt row OR a total-debt value > 0
  if (!opts.skipValidation) {
    const company = (lead.businessName ?? "").trim();
    let sfData: Record<string, unknown> = {};
    try { sfData = lead.sfDataJson ? JSON.parse(lead.sfDataJson) as Record<string, unknown> : {}; } catch { /* */ }
    const totalDebt = Number(sfData.Total_Debt_Amount__c ?? sfData.Total_Debt__c ?? lead.totalDebtEst ?? 0);
    const hasDebt = lead.debts.length > 0 || totalDebt > 0;
    if (!company || !hasDebt) {
      const missing = [!company ? "Company" : null, !hasDebt ? "Debt Information" : null]
        .filter(Boolean)
        .join(" and ");
      throw new Error(`${missing} ${!company && !hasDebt ? "are" : "is"} required to convert a Lead`);
    }
  }

  const hasBusinessName = !!lead.businessName?.trim();
  const accountRecordType: AccountRecordType =
    opts.accountRecordType && isAccountRecordType(opts.accountRecordType)
      ? opts.accountRecordType
      : defaultAccountRecordTypeForLead({
          leadRecordType: lead.recordType,
          hasBusinessName,
        });

  const accountName = hasBusinessName ? lead.businessName : lead.contactName;
  const accountType = accountRecordType === "PERSON_ACCOUNT" ? "PERSON" : "ORG";

  const { firstName, lastName } = splitContactName(lead.contactName);
  const fullName = lead.contactName.trim();

  // Run everything in a transaction so a failure half-way leaves no orphans.
  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        recordType: accountRecordType,
        name: accountName,
        type: accountType,
        ein: lead.ein,
        phone: lead.phone,
        email: lead.email,
        industry: lead.industry,
        annualRevenue: lead.annualRevenue,
        ownerId: opts.accountOwnerId ?? lead.assignedToId ?? null,
      },
    });

    const contact = await tx.contact.create({
      data: {
        firstName,
        lastName,
        fullName,
        email: lead.email,
        phone: lead.phone,
        primaryAccountId: account.id,
        ownerId: opts.accountOwnerId ?? lead.assignedToId ?? null,
      },
    });

    await tx.accountContactRelation.create({
      data: {
        accountId: account.id,
        contactId: contact.id,
        role: opts.contactRole ?? "Primary Contact",
      },
    });

    let opportunityId: string | null = null;
    if (!opts.doNotCreateOpportunity) {
      const oppRecordType =
        opts.opportunityRecordType && isOpportunityRecordType(opts.opportunityRecordType)
          ? opts.opportunityRecordType
          : "DEBT_SETTLEMENT";
      const oppName = opts.opportunityName ?? defaultOpportunityName(account.name, oppRecordType);
      const opp = await tx.opportunity.create({
        data: {
          recordType: oppRecordType,
          leadId: lead.id,
          accountId: account.id,
          primaryContactId: contact.id,
          stage: "WORKING_OPPORTUNITY",
          totalDebt: lead.totalDebtEst,
          assignedToId: lead.assignedToId,
          notes: `Converted from lead ${lead.id} (${oppName})`,
        },
      });
      opportunityId = opp.id;

      // Copy Lead debts into the new Opportunity
      for (const d of lead.debts) {
        await tx.debt.create({
          data: {
            opportunityId: opp.id,
            creditorName: d.creditorName ?? "Unknown",
            debtType: d.type,
            paymentFrequency: d.frequency,
            paymentAmount: d.paymentAmount,
            originalBalance: d.amount,
            currentBalance: d.amount,
            enrolledBalance: d.amount,
            status: d.status === "DEFAULTED" ? "ENROLLED" : d.status === "SETTLED" ? "SETTLED" : "ENROLLED",
            notes: d.notes,
          },
        });
      }
    }

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        convertedAccountId: account.id,
        convertedContactId: contact.id,
        convertedOpportunityId: opportunityId,
        convertedAt: new Date(),
        status: "Converted",
      },
    });

    return { accountId: account.id, contactId: contact.id, opportunityId };
  });

  // Audit (outside the transaction; non-blocking semantics)
  await Promise.all([
    auditWrite({
      userId: opts.performedById ?? lead.assignedToId ?? null,
      entity: "Account",
      entityId: result.accountId,
      action: "CREATE",
      after: { source: "lead-conversion", leadId: lead.id },
    }).catch(() => null),
    auditWrite({
      userId: opts.performedById ?? lead.assignedToId ?? null,
      entity: "Lead",
      entityId: lead.id,
      action: "UPDATE",
      before: { status: lead.status, convertedAccountId: null },
      after: { status: "Converted", convertedAccountId: result.accountId },
    }).catch(() => null),
  ]);

  // Marketing postback: lead.converted (fire-and-forget)
  void firePostbackEvent({
    event: "lead.converted",
    entityType: "Lead",
    entityId: lead.id,
    data: {
      lead,
      accountId: result.accountId,
      contactId: result.contactId,
      opportunityId: result.opportunityId,
    },
  }).catch(() => {});

  return { ...result, alreadyConverted: false };
}
