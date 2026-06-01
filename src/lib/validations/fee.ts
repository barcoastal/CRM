import { z } from "zod";
import { FEE_RECORD_TYPES } from "@/lib/record-types";

export const createFeeSchema = z.object({
  programPlanId: z.string().cuid(),
  recordType: z.enum(FEE_RECORD_TYPES).default("MONTHLY_ADMIN"),
  amount: z.number().positive(),
  chargedDate: z.string().datetime().optional(),
  status: z.enum(["PENDING", "CHARGED", "WAIVED", "REFUNDED"]).default("PENDING"),
  notes: z.string().optional().nullable(),
});

export const updateFeeSchema = z.object({
  status: z.enum(["PENDING", "CHARGED", "WAIVED", "REFUNDED"]).optional(),
  amount: z.number().positive().optional(),
  notes: z.string().optional().nullable(),
});
