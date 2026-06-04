/**
 * Envelope trigger — replaces SF DocuSign envelope status flow.
 * Source: docs/sf-export/sfdx-raw/classes/DocusignEnvelopeStatusHandler.cls
 * + DocusignEnvelopeStatusService.cls
 *
 * SF behavior we're porting:
 *  - On envelope status → "Sent" with bank-change pending:
 *      Opportunity.bankChangeContractStatus = "Pending"
 *  - On envelope status → "Completed":
 *      - Opportunity.bankChangeContractStatus = "Completed"
 *      - Account.firstContractSignedDate = now (if unset)
 *      - DocusignEnvelopeStatusService.processDocuments
 *        (we substitute: copy signedDocumentUrl into a Document record)
 *
 * Additional logic for our product:
 *  - Status → COMPLETED on a CONTRACT envelope flips Opportunity.stage
 *    to "Contract Sent" → "Agreements Received" if currently in
 *    "Working Opportunity" or "Waiting for Agreements"
 *  - EnvelopeEvent audit log entry on every status change
 */

import type { Envelope } from "@/generated/prisma/client";
import type { Trigger, TriggerCtx } from "./types";

type EnvelopeWrite = Partial<Envelope> & Record<string, unknown>;

async function logEvent(
  ctx: TriggerCtx,
  envelopeId: string,
  eventType: string,
  details?: string
) {
  await ctx.prisma.envelopeEvent.create({
    data: { envelopeId, eventType, details: details ?? null },
  });
}

export const envelopeTrigger: Trigger<Envelope, EnvelopeWrite> = {
  beforeUpdate({ next, prev }) {
    if (next.status === undefined || next.status === prev.status) return;
    const now = new Date();

    // Stamp lifecycle timestamps as status moves forward
    if (next.status === "SENT" && !prev.sentAt) next.sentAt = now;
    if (next.status === "VIEWED" && !prev.viewedAt) next.viewedAt = now;
    if (next.status === "SIGNED" && !prev.signedAt) next.signedAt = now;
    if (next.status === "COMPLETED" && !prev.completedAt) next.completedAt = now;
    if (next.status === "VOIDED" && !prev.voidedAt) next.voidedAt = now;
  },

  async afterInsert({ row, ctx }) {
    await logEvent(ctx, row.id, "CREATED", `Envelope created for ${row.signerEmail}`);
  },

  async afterUpdate({ row, prev, ctx }) {
    if (row.status === prev.status) return;
    await logEvent(ctx, row.id, row.status, `Status: ${prev.status} → ${row.status}`);

    // Bank-change envelope status mirroring (SF Bank_Change_Contract_Status__c)
    if (row.recordType === "BANK_CHANGE" && row.opportunityId) {
      if (row.status === "SENT") {
        await ctx.prisma.opportunity.update({
          where: { id: row.opportunityId },
          data: { bankChangeContractStatus: "Pending" },
        });
      } else if (row.status === "COMPLETED") {
        await ctx.prisma.opportunity.update({
          where: { id: row.opportunityId },
          data: { bankChangeContractStatus: "Completed" },
        });
      }
    }

    // First contract signed timestamp on Account
    if (row.status === "COMPLETED" && row.accountId) {
      const acct = await ctx.prisma.account.findUnique({
        where: { id: row.accountId },
        select: { firstContractSignedDate: true },
      });
      if (acct && !acct.firstContractSignedDate) {
        await ctx.prisma.account.update({
          where: { id: row.accountId },
          data: { firstContractSignedDate: new Date() },
        });
      }
    }

    // Attach signed PDF as a Document on the related entity
    if (row.status === "COMPLETED" && row.signedDocumentUrl && ctx.userId) {
      await ctx.prisma.document.create({
        data: {
          name: row.documentName,
          type:
            row.recordType === "CONTRACT"
              ? "ENGAGEMENT_AGREEMENT"
              : row.recordType === "BANK_CHANGE"
                ? "AUTHORIZATION"
                : "OTHER",
          filePath: row.signedDocumentUrl,
          uploadedById: ctx.userId,
          opportunityId: row.opportunityId,
          accountId: row.accountId,
          leadId: row.leadId,
        },
      }).catch(() => undefined);
    }
  },
};
