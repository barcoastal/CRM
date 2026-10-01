import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  packet: vi.fn(),
  credential: vi.fn(),
  native: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    signingPacket: { findUnique: m.packet },
    integrationCredential: { findUnique: m.credential },
  },
}));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: m.native }));
import {
  issueEmbedToken,
  verifyEmbedToken,
  requirePacketAuth,
} from "@/lib/esign/salesforce/embed";
const config = {
  orgId: "00DjI0000002jHBUAY",
  opportunityId: "006jI000000HCfvQAG",
  salesforceUserId: "005VO00000B4lmoYAB",
  senderUserId: "sender",
  recipientEmail: "bar@coastaldebt.com",
  instanceUrl: "https://cdcrm--newdocusig.sandbox.lightning.force.com",
  secretHash: "a".repeat(64),
};
const source = {
  orgId: config.orgId,
  opportunityId: config.opportunityId,
  requestId: "a".repeat(32),
  recipientEmail: config.recipientEmail,
  snapshotHash: "hash",
  sandbox: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.packet.mockResolvedValue({
    createdById: "sender",
    salesforceSource: source,
  });
  m.credential.mockResolvedValue({ isActive: true, config });
});
it("limits capabilities to packet, org, user, signing key and expiry", () => {
  const now = Date.now();
  const t = issueEmbedToken(config, "packet", now);
  expect(verifyEmbedToken(t, config, "packet", now)).toBe(true);
  expect(verifyEmbedToken(t, config, "other", now)).toBe(false);
  expect(
    verifyEmbedToken(
      t,
      { ...config, secretHash: "b".repeat(64) },
      "packet",
      now,
    ),
  ).toBe(false);
  expect(
    verifyEmbedToken(
      t,
      { ...config, salesforceUserId: "other" },
      "packet",
      now,
    ),
  ).toBe(false);
  expect(verifyEmbedToken(t, config, "packet", now + 1800000)).toBe(false);
  expect(verifyEmbedToken(t + ".extra", config, "packet", now)).toBe(false);
});
const request = () =>
  new Request("https://crm.example/api/esign/packets/packet", {
    headers: { Authorization: `Bearer ${issueEmbedToken(config, "packet")}` },
  });
it("authorizes only the mapped sender packet", async () => {
  expect(
    await requirePacketAuth(request(), "packet", "Opportunity.Edit"),
  ).toEqual({ session: { userId: "sender" } });
  expect(m.native).not.toHaveBeenCalled();
  m.packet.mockResolvedValue({
    createdById: "another",
    salesforceSource: source,
  });
  expect(
    await requirePacketAuth(request(), "packet", "Opportunity.Edit"),
  ).toHaveProperty("response.status", 401);
});
it("revokes access when integration disabled or packet outside pilot", async () => {
  m.credential.mockResolvedValue({ isActive: false, config });
  expect(
    await requirePacketAuth(request(), "packet", "Opportunity.Edit"),
  ).toHaveProperty("response.status", 401);
  m.credential.mockResolvedValue({ isActive: true, config });
  m.packet.mockResolvedValue({
    createdById: "sender",
    salesforceSource: { ...source, opportunityId: "other" },
  });
  expect(
    await requirePacketAuth(request(), "packet", "Opportunity.Edit"),
  ).toHaveProperty("response.status", 401);
});
it("preserves normal CRM permission checks without a capability", async () => {
  m.native.mockResolvedValue({ response: { status: 403 } });
  await requirePacketAuth(
    new Request("https://crm.example"),
    "packet",
    "Opportunity.Edit",
  );
  expect(m.native).toHaveBeenCalledWith("Opportunity.Edit");
});
