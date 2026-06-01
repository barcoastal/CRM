import { z } from "zod";

export const createPaymentProcessorSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(64),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updatePaymentProcessorSchema = createPaymentProcessorSchema.partial();
