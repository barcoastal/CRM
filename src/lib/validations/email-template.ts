import { z } from "zod";

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  developerName: z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Use only A-Z, 0-9, and _"),
  subject: z.string().min(1).max(500),
  bodyText: z.string().optional().nullable(),
  bodyHtml: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  folder: z.string().optional().default("General"),
  isActive: z.boolean().default(true),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial();
