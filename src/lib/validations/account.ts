import { z } from "zod";
import { ACCOUNT_RECORD_TYPES } from "@/lib/record-types";

export const createAccountSchema = z.object({
  recordType: z.enum(ACCOUNT_RECORD_TYPES).default("CLIENT"),
  name: z.string().min(1, "Name is required").max(255),
  type: z.enum(["ORG", "PERSON"]).default("ORG"),
  ein: z.string().optional().nullable(),
  ssnLast4: z.string().regex(/^\d{4}$/, "Last 4 must be 4 digits").optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  website: z.string().url().optional().nullable(),
  industry: z.string().optional().nullable(),
  annualRevenue: z.number().nonnegative().optional().nullable(),
  numberOfEmployees: z.number().int().nonnegative().optional().nullable(),
  description: z.string().optional().nullable(),
  billingStreet: z.string().optional().nullable(),
  billingCity: z.string().optional().nullable(),
  billingState: z.string().optional().nullable(),
  billingZip: z.string().optional().nullable(),
  billingCountry: z.string().default("US").optional(),
  ownerId: z.string().cuid().optional().nullable(),
  parentAccountId: z.string().cuid().optional().nullable(),
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
