import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { contractSchema } from "./contract-data";
import type { PacketConfig } from "../packet-config";
export const pilotConfigSchema = z.object({
  orgId: z.string().regex(/^00D[a-zA-Z0-9]{15}$/),
  opportunityId: z.string().regex(/^006[a-zA-Z0-9]{15}$/),
  salesforceUserId: z.string().regex(/^005[a-zA-Z0-9]{15}$/),
  senderUserId: z.string().min(1),
  instanceUrl: z
    .string()
    .regex(/^https:\/\/[a-z0-9-]+\.sandbox\.lightning\.force\.com$/),
  recipientEmail: z.email(),
  secretHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type PilotConfig = z.infer<typeof pilotConfigSchema>;
export const snapshotSchema = z.object({
  opportunityId: z.string().regex(/^006[a-zA-Z0-9]{15}$/),
  requestId: z.string().regex(/^[a-fA-F0-9-]{32,36}$/),
  salesforceUserId: z.string().regex(/^005[a-zA-Z0-9]{15}$/),
  accountName: z.string().trim().min(1).max(150),
  signerName: z.string().trim().min(2).max(150),
  signerEmail: z.email(),
  street: z.string().max(255).default(""),
  city: z.string().max(100).default(""),
  state: z.string().max(100).default(""),
  postalCode: z.string().max(20).default(""),
  country: z.string().max(80).default("United States"),
  totalDebt: z.number().positive().max(10000000),
  processor: z.enum(["SAS", "RAM"]),
  includeAddendum: z.boolean(),
  contract: contractSchema,
});
export type SalesforceSnapshot = z.infer<typeof snapshotSchema>;
export const sourceSchema = z.object({
  orgId: z.string(),
  opportunityId: z.string(),
  requestId: z.string(),
  recipientEmail: z.email(),
  sandbox: z.literal(true),
  snapshotHash: z.string(),
});
export function secretMatches(secret: string, hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash) || !/^[a-f0-9]{64}$/.test(secret))
    return false;
  return timingSafeEqual(
    createHash("sha256").update(secret).digest(),
    Buffer.from(hash, "hex"),
  );
}
export function snapshotAllowed(s: SalesforceSnapshot, c: PilotConfig) {
  return (
    s.opportunityId === c.opportunityId &&
    s.salesforceUserId === c.salesforceUserId &&
    s.signerEmail.toLowerCase() === c.recipientEmail.toLowerCase() &&
    s.accountName.startsWith("TEST -")
  );
}
export function sandboxRecipientError(
  source: unknown,
  config: PacketConfig,
): string | null {
  if (!source) return null;
  const parsed = sourceSchema.safeParse(source);
  if (!parsed.success) return "Invalid Salesforce pilot configuration.";
  if (
    config.recipients.some(
      (r) => r.email.toLowerCase() !== parsed.data.recipientEmail.toLowerCase(),
    )
  )
    return `Sandbox pilot: every recipient must be ${parsed.data.recipientEmail}.`;
  if (!config.subject.startsWith("[TEST]"))
    return "Sandbox email subjects must start with [TEST].";
  return null;
}
export function pilotPacketId(
  orgId: string,
  opportunityId: string,
  requestId: string,
) {
  return (
    "sfp_" +
    createHash("sha256")
      .update(`${orgId}:${opportunityId}:${requestId}`)
      .digest("hex")
      .slice(0, 40)
  );
}
