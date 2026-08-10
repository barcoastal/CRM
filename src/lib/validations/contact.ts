import { z } from "zod";

export const createContactSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).default(""),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  mobilePhone: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  birthdate: z.string().datetime().optional().nullable(),
  primaryAccountId: z.string().min(1).optional().nullable(),
  setPrimaryForAccount: z.boolean().optional(),
  ownerId: z.string().cuid().optional().nullable(),
});

export const updateContactSchema = createContactSchema.partial();

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
