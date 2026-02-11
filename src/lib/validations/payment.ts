import { z } from "zod";

export const PAYMENT_TYPES = [
  "CLIENT_PAYMENT",
  "SETTLEMENT_PAYOUT",
  "FEE",
] as const;

export const PAYMENT_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "MISSED",
  "CANCELLED",
] as const;

export const DOCUMENT_TYPES = [
  "ENGAGEMENT_AGREEMENT",
  "HARDSHIP_LETTER",
  "AUTHORIZATION",
  "SETTLEMENT_OFFER",
  "BANK_STATEMENT",
  "TAX_RETURN",
  "OTHER",
] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const createPaymentSchema = z.object({
  debtId: z.string().optional().or(z.literal("")),
  type: z.enum(PAYMENT_TYPES),
  amount: z.coerce.number().positive("Amount must be positive"),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  paidDate: z.string().optional().or(z.literal("")),
  status: z.enum(PAYMENT_STATUSES).default("SCHEDULED"),
  reference: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const updatePaymentSchema = z.object({
  paidDate: z.string().optional().or(z.literal("")),
  status: z.enum(PAYMENT_STATUSES).optional(),
  reference: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const createDocumentSchema = z.object({
  name: z.string().min(1, "Document name is required"),
  type: z.enum(DOCUMENT_TYPES),
  filePath: z.string().min(1, "File path is required"),
  fileSize: z.coerce.number().int().min(0).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
