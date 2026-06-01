import { z } from "zod";

export const createOfferSchema = z.object({
  debtId: z.string().cuid(),
  direction: z.enum(["FROM_US", "FROM_CREDITOR"]).default("FROM_US"),
  amountOffered: z.number().positive(),
  percentOffered: z.number().min(0).max(1).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  termsNotes: z.string().optional().nullable(),
});

export const updateOfferSchema = z.object({
  status: z.enum(["PENDING", "COUNTERED", "ACCEPTED", "REJECTED", "EXPIRED", "WITHDRAWN"]).optional(),
  counterAmount: z.number().positive().optional().nullable(),
  termsNotes: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});
