import { z } from "zod";

export const INTEGRATION_PROVIDERS = [
  "FIVE9", "TWILIO", "TELNYX", "DOCUSIGN", "PARDOT", "KLAVIYO", "SENDGRID", "POSTMARK", "MAILGUN",
] as const;

export const createIntegrationCredentialSchema = z.object({
  provider: z.enum(INTEGRATION_PROVIDERS),
  name: z.string().min(1).max(255),
  isActive: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()),
  scopes: z.string().optional().nullable(),
});

export const updateIntegrationCredentialSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  scopes: z.string().optional().nullable(),
  rotatedAt: z.string().datetime().optional().nullable(),
});
