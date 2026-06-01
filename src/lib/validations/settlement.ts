import { z } from "zod";
import { SETTLEMENT_RECORD_TYPES } from "@/lib/record-types";

export const updateSettlementSchema = z.object({
  status: z.enum(["PENDING_PAYOFF", "PAID", "CANCELLED"]).optional(),
  recordType: z.enum(SETTLEMENT_RECORD_TYPES).optional(),
  payoffDueDate: z.string().datetime().optional().nullable(),
  payoffPaidDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const acceptOfferBodySchema = z.object({
  recordType: z.enum(SETTLEMENT_RECORD_TYPES).optional(),
  payoffDueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  approvedById: z.string().cuid().optional(),
});
