import { z } from "zod";

export const DEBT_STATUSES = [
  "ENROLLED",
  "NEGOTIATING",
  "SETTLED",
  "PAID",
  "DISPUTED",
  "WRITTEN_OFF",
] as const;

export const NEGOTIATION_TYPES = [
  "CALL",
  "EMAIL",
  "LETTER",
  "FAX",
] as const;

export const NEGOTIATION_RESPONSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "COUNTERED",
] as const;

export type DebtStatus = (typeof DEBT_STATUSES)[number];
export type NegotiationType = (typeof NEGOTIATION_TYPES)[number];
export type NegotiationResponse = (typeof NEGOTIATION_RESPONSES)[number];

export const createDebtSchema = z.object({
  creditorName: z.string().min(1, "Creditor name is required"),
  creditorPhone: z.string().optional().or(z.literal("")),
  creditorEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  accountNumber: z.string().optional().or(z.literal("")),
  originalBalance: z.coerce.number().positive("Original balance must be positive"),
  currentBalance: z.coerce.number().min(0, "Current balance cannot be negative"),
  enrolledBalance: z.coerce.number().positive("Enrolled balance must be positive"),
  notes: z.string().optional().or(z.literal("")),
});

export const updateDebtSchema = z.object({
  creditorName: z.string().min(1).optional(),
  creditorPhone: z.string().optional().or(z.literal("")),
  creditorEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  accountNumber: z.string().optional().or(z.literal("")),
  originalBalance: z.coerce.number().positive().optional(),
  currentBalance: z.coerce.number().min(0).optional(),
  enrolledBalance: z.coerce.number().positive().optional(),
  status: z.enum(DEBT_STATUSES).optional(),
  settledAmount: z.coerce.number().min(0).optional().nullable(),
  settledDate: z.string().optional().or(z.literal("")),
  isDelinquent: z.boolean().optional(),
  notes: z.string().optional().or(z.literal("")),
});

export const createNegotiationSchema = z.object({
  type: z.enum(NEGOTIATION_TYPES),
  date: z.string().min(1, "Date is required"),
  offerAmount: z.coerce.number().min(0).optional().nullable(),
  offerPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  response: z.enum(NEGOTIATION_RESPONSES).default("PENDING"),
  counterAmount: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().or(z.literal("")),
});

export type CreateDebtInput = z.infer<typeof createDebtSchema>;
export type UpdateDebtInput = z.infer<typeof updateDebtSchema>;
export type CreateNegotiationInput = z.infer<typeof createNegotiationSchema>;
