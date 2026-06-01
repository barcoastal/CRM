import { z } from "zod";

export const createCreditorSchema = z.object({
  accountId: z.string().cuid().optional(),
  // Or create an Account inline:
  accountName: z.string().min(1).optional(),
  legalName: z.string().min(1).max(255),
  collectionsPhone: z.string().optional().nullable(),
  collectionsEmail: z.string().email().optional().nullable(),
  settlementPolicy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(
  (d) => !!d.accountId || !!d.accountName,
  { message: "Either accountId or accountName must be provided" },
);

export const updateCreditorSchema = z.object({
  legalName: z.string().min(1).max(255).optional(),
  collectionsPhone: z.string().optional().nullable(),
  collectionsEmail: z.string().email().optional().nullable(),
  settlementPolicy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateCreditorInput = z.infer<typeof createCreditorSchema>;
export type UpdateCreditorInput = z.infer<typeof updateCreditorSchema>;
