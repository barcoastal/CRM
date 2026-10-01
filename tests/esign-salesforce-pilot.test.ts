import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  secretMatches,
  snapshotAllowed,
  snapshotSchema,
  sandboxRecipientError,
  pilotPacketId,
  type PilotConfig,
} from "@/lib/esign/salesforce/policy";
import type { PacketConfig } from "@/lib/esign/packet-config";
const config: PilotConfig = {
  orgId: "00DjI0000002jHBUAY",
  opportunityId: "006jI000000HCfvQAG",
  salesforceUserId: "005VO00000B4lmoYAB",
  senderUserId: "crm-sender",
  instanceUrl: "https://cdcrm--newdocusig.sandbox.lightning.force.com",
  recipientEmail: "bar@coastaldebt.com",
  secretHash: createHash("sha256").update("a".repeat(64)).digest("hex"),
};
const snapshot = snapshotSchema.parse({
  opportunityId: config.opportunityId,
  requestId: "a".repeat(32),
  salesforceUserId: config.salesforceUserId,
  accountName: "TEST - Pilot",
  signerName: "Test Signer",
  signerEmail: config.recipientEmail,
  totalDebt: 150000,
});
const source = {
  orgId: config.orgId,
  opportunityId: config.opportunityId,
  requestId: snapshot.requestId,
  recipientEmail: config.recipientEmail,
  sandbox: true,
  snapshotHash: "hash",
};
const packet = {
  subject: "[TEST] Pilot",
  recipients: [{ email: config.recipientEmail }],
} as PacketConfig;
describe("Salesforce sandbox isolation", () => {
  it("authenticates only a full matching secret", () => {
    expect(secretMatches("a".repeat(64), config.secretHash)).toBe(true);
    expect(secretMatches("b".repeat(64), config.secretHash)).toBe(false);
    expect(secretMatches("", config.secretHash)).toBe(false);
    expect(secretMatches("a".repeat(64), "bad")).toBe(false);
  });
  it("limits preparation to the configured sender, record and recipient", () => {
    expect(snapshotAllowed(snapshot, config)).toBe(true);
    for (const patch of [
      { opportunityId: "006jI000000AAAAAAA" },
      { salesforceUserId: "005jI000000AAAAAAA" },
      { signerEmail: "other@example.com" },
      { accountName: "Real customer" },
    ])
      expect(snapshotAllowed({ ...snapshot, ...patch }, config)).toBe(false);
  });
  it("rejects invalid debt amounts and unbounded snapshot values", () => {
    expect(
      snapshotSchema.safeParse({ ...snapshot, totalDebt: -1 }).success,
    ).toBe(false);
    expect(
      snapshotSchema.safeParse({ ...snapshot, street: "x".repeat(256) })
        .success,
    ).toBe(false);
  });
  it("retries the same packet but separates different orgs and opportunities", () => {
    const id = pilotPacketId(
      config.orgId,
      snapshot.opportunityId,
      snapshot.requestId,
    );
    expect(id).toBe(
      pilotPacketId(config.orgId, snapshot.opportunityId, snapshot.requestId),
    );
    expect(id).not.toBe(
      pilotPacketId("other", snapshot.opportunityId, snapshot.requestId),
    );
    expect(id).not.toBe(
      pilotPacketId(config.orgId, "other", snapshot.requestId),
    );
  });
  it("blocks changed signing and copy recipients at save/send", () => {
    expect(sandboxRecipientError(source, packet)).toBe(null);
    expect(
      sandboxRecipientError(source, {
        ...packet,
        recipients: [
          ...packet.recipients,
          { email: "other@example.com", action: "COPY" } as never,
        ],
      }),
    ).toMatch(/every recipient/);
    expect(
      sandboxRecipientError(source, { ...packet, subject: "Contract" }),
    ).toMatch(/\[TEST\]/);
  });
  it("fails closed for malformed pilot metadata but leaves native packets unchanged", () => {
    expect(sandboxRecipientError({}, packet)).toMatch(/Invalid/);
    expect(sandboxRecipientError(null, packet)).toBe(null);
  });
});
