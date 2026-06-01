import { z } from "zod";
import { PROGRAM_PLAN_RECORD_TYPES } from "@/lib/record-types";

export const createProgramPlanSchema = z.object({
  recordType: z.enum(PROGRAM_PLAN_RECORD_TYPES).default("DEBT_SETTLEMENT"),
  accountId: z.string().cuid(),
  opportunityId: z.string().cuid().optional().nullable(),
  processorId: z.string().cuid().optional().nullable(),
  assignedToId: z.string().cuid().optional().nullable(),
  status: z.enum(["PROPOSED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
  startDate: z.string().datetime(),
  termMonths: z.number().int().positive(),
  monthlyAmount: z.number().positive(),
  totalEnrolledDebt: z.number().nonnegative().optional().nullable(),
  bankAccountLast4: z.string().regex(/^\d{4}$/).optional().nullable(),
  bankRoutingLast4: z.string().regex(/^\d{4}$/).optional().nullable(),
  signedDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateProgramPlanSchema = createProgramPlanSchema.partial().omit({ accountId: true });
