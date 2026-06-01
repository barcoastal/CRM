import { z } from "zod";

export const createSmsSchema = z.object({
  direction: z.enum(["INBOUND", "OUTBOUND"]).default("OUTBOUND"),
  status: z.enum(["QUEUED", "SENT", "DELIVERED", "FAILED", "RECEIVED"]).default("QUEUED"),
  fromNumber: z.string().min(1),
  toNumber: z.string().min(1),
  body: z.string().min(1).max(1600),
  segments: z.number().int().positive().default(1),

  accountId: z.string().cuid().optional().nullable(),
  contactId: z.string().cuid().optional().nullable(),
  leadId: z.string().cuid().optional().nullable(),
  caseId: z.string().cuid().optional().nullable(),

  ownerId: z.string().cuid().optional().nullable(),

  providerMessageId: z.string().optional().nullable(),
  provider: z.string().optional().nullable(),
});

export const updateSmsSchema = z.object({
  status: z.enum(["QUEUED", "SENT", "DELIVERED", "FAILED", "RECEIVED"]).optional(),
  errorReason: z.string().optional().nullable(),
  errorCode: z.string().optional().nullable(),
  providerMessageId: z.string().optional().nullable(),
});
