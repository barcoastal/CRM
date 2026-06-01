import { z } from "zod";
import { DRAFT_STATUSES } from "@/lib/draft-state-machine";

export const createDraftSchema = z.object({
  programPlanId: z.string().cuid(),
  debitScheduleId: z.string().cuid().optional().nullable(),
  scheduledDate: z.string().datetime(),
  amount: z.number().positive(),
  attemptNumber: z.number().int().positive().default(1),
  maxAttempts: z.number().int().positive().default(3),
  notes: z.string().optional().nullable(),
});

export const updateDraftSchema = z.object({
  status: z.enum(DRAFT_STATUSES).optional(),
  scheduledDate: z.string().datetime().optional(),
  returnCode: z.string().optional().nullable(),
  returnReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
