import { z } from "zod";

export const createEmailSchema = z.object({
  direction: z.enum(["INBOUND", "OUTBOUND"]).default("OUTBOUND"),
  status: z.enum(["DRAFT", "QUEUED", "SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "COMPLAINED", "FAILED"]).default("DRAFT"),
  fromAddress: z.string().email(),
  toAddresses: z.string().min(1), // CSV of emails
  cc: z.string().optional().nullable(),
  bcc: z.string().optional().nullable(),
  subject: z.string().min(1).max(500),
  bodyText: z.string().optional().nullable(),
  bodyHtml: z.string().optional().nullable(),

  templateId: z.string().cuid().optional().nullable(),

  accountId: z.string().cuid().optional().nullable(),
  contactId: z.string().cuid().optional().nullable(),
  leadId: z.string().cuid().optional().nullable(),
  opportunityId: z.string().cuid().optional().nullable(),
  caseId: z.string().cuid().optional().nullable(),

  ownerId: z.string().cuid().optional().nullable(),

  providerMessageId: z.string().optional().nullable(),
  provider: z.string().optional().nullable(),
});

export const updateEmailSchema = z.object({
  status: z.enum(["DRAFT", "QUEUED", "SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "COMPLAINED", "FAILED"]).optional(),
  bodyText: z.string().optional().nullable(),
  bodyHtml: z.string().optional().nullable(),
  errorReason: z.string().optional().nullable(),
  providerMessageId: z.string().optional().nullable(),
});
