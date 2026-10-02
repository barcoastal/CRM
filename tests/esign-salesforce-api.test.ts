import { contractFixture } from "./fixtures/salesforce-contract";
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  find: vi.fn(),
  event: vi.fn(),
  read: vi.fn(),
  prepare: vi.fn(),
}));
vi.mock("@/lib/esign/salesforce/auth", () => ({
  authenticateSalesforcePilot: m.auth,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    signingPacket: { findFirst: m.find },
    envelopeEvent: { findFirst: m.event },
  },
}));
vi.mock("node:fs/promises", () => ({ readFile: m.read }));
vi.mock("@/lib/esign/storage", () => ({
  signedDir: () => "/data/esign-signed",
}));
vi.mock("@/lib/esign/salesforce/prepare", () => ({
  prepareSalesforcePilot: m.prepare,
}));
import { GET } from "@/app/api/esign/salesforce/packets/[id]/route";
import { POST } from "@/app/api/esign/salesforce/packets/route";
import { createHash } from "node:crypto";
const pilot = {
  orgId: "00DjI0000002jHBUAY",
  opportunityId: "006jI000000HCfvQAG",
  salesforceUserId: "005VO00000B4lmoYAB",
  senderUserId: "sender",
  recipientEmail: "bar@coastaldebt.com",
};
const source = {
  ...pilot,
  requestId: "a".repeat(32),
  snapshotHash: "hash",
  sandbox: true,
};
const packet = {
  id: "packet",
  status: "COMPLETED",
  salesforceSource: source,
  completedPdfPath: "signed.pdf",
  envelopes: [{ id: "envelope", status: "COMPLETED" }],
};
const get = (download = false) =>
  GET(
    new NextRequest(
      "https://crm.example/api/esign/salesforce/packets/packet" +
        (download ? "?download=true" : ""),
    ),
    { params: Promise.resolve({ id: "packet" }) },
  );
const snapshot = {
  opportunityId: pilot.opportunityId,
  requestId: "a".repeat(32),
  salesforceUserId: pilot.salesforceUserId,
  accountName: "TEST - Pilot",
  signerName: "Test Signer",
  signerEmail: pilot.recipientEmail,
  totalDebt: 150000,
  processor: "SAS", includeAddendum:false, contract: contractFixture,
};
const post = (body: unknown) =>
  POST(
    new NextRequest("https://crm.example/api/esign/salesforce/packets", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue(pilot);
  m.find.mockResolvedValue(structuredClone(packet));
  m.prepare.mockResolvedValue({ id: "packet", status: "DRAFT" });
  m.read.mockResolvedValue(Buffer.from("%PDF sample"));
  m.event.mockResolvedValue({
    details: JSON.stringify({
      signedSha256: createHash("sha256").update("%PDF sample").digest("hex"),
    }),
  });
});
it("rejects unauthenticated requests before reading or creating packets", async () => {
  m.auth.mockResolvedValue(null);
  expect((await get(true)).status).toBe(401);
  expect((await post(snapshot)).status).toBe(401);
  expect(m.find).not.toHaveBeenCalled();
  expect(m.prepare).not.toHaveBeenCalled();
});
it("cannot read another org or Opportunity packet", async () => {
  for (const patch of [{ orgId: "other" }, { opportunityId: "other" }]) {
    m.find.mockResolvedValue({
      ...packet,
      salesforceSource: { ...source, ...patch },
    });
    expect((await get(true)).status).toBe(404);
  }
  expect(m.read).not.toHaveBeenCalled();
});
it("only transfers completed PDFs with matching integrity evidence", async () => {
  m.find.mockResolvedValue({ ...packet, status: "SENT" });
  expect((await get(true)).status).toBe(409);
  m.find.mockResolvedValue(packet);
  m.event.mockResolvedValue({ details: '{"signedSha256":"wrong"}' });
  expect((await get(true)).status).toBe(409);
});
it("returns an authenticated completed PDF with its verified bytes", async () => {
  const r = await get(true);
  expect(r.status).toBe(200);
  expect((await r.json()).pdfBase64).toBe(
    Buffer.from("%PDF sample").toString("base64"),
  );
  expect(m.read).toHaveBeenCalledWith("/data/esign-signed/signed.pdf");
});
it("never prepares for an unapproved sender or recipient", async () => {
  expect(
    (await post({ ...snapshot, signerEmail: "outsider@example.com" })).status,
  ).toBe(403);
  expect(
    (await post({ ...snapshot, salesforceUserId: "005VO00000B4lmoXXX" }))
      .status,
  ).toBe(403);
  expect(m.prepare).not.toHaveBeenCalled();
});
it("prepares an authorized snapshot without sending an email", async () => {
  expect((await post(snapshot)).status).toBe(200);
  expect(m.prepare).toHaveBeenCalledTimes(1);
});
