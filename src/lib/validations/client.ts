import { z } from "zod";

export const CLIENT_STATUSES = [
  "ACTIVE",
  "GRADUATED",
  "DROPPED",
  "ON_HOLD",
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const createClientSchema = z.object({
  leadId: z.string().min(1, "Lead is required"),
  programStartDate: z.string().min(1, "Program start date is required"),
  programLength: z.coerce.number().int().min(1, "Program length must be at least 1 month"),
  monthlyPayment: z.coerce.number().positive("Monthly payment must be positive"),
  totalEnrolledDebt: z.coerce.number().positive("Total enrolled debt must be positive"),
  assignedNegotiatorId: z.string().optional().or(z.literal("")),
});

export const updateClientSchema = z.object({
  programLength: z.coerce.number().int().min(1).optional(),
  monthlyPayment: z.coerce.number().positive().optional(),
  totalEnrolledDebt: z.coerce.number().positive().optional(),
  totalSettled: z.coerce.number().min(0).optional(),
  totalFees: z.coerce.number().min(0).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  assignedNegotiatorId: z.string().optional().or(z.literal("")),
});

export const enrollClientSchema = z.object({
  programStartDate: z.string().min(1, "Program start date is required"),
  programLength: z.coerce.number().int().min(1, "Program length must be at least 1 month").max(60, "Program length cannot exceed 60 months"),
  monthlyPayment: z.coerce.number().positive("Monthly payment must be positive"),
  totalEnrolledDebt: z.coerce.number().positive("Total enrolled debt must be positive"),
  assignedNegotiatorId: z.string().optional().or(z.literal("")),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type EnrollClientInput = z.infer<typeof enrollClientSchema>;
