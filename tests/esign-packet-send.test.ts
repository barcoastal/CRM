import { it, expect, vi, beforeEach } from "vitest";
import { PDFDocument } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  find: vi.fn(),
  cas: vi.fn(),
  create: vi.fn(),
  event: vi.fn(),
  advance: vi.fn(),
  deliver: vi.fn(),
  verified: vi.fn(),
}));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: m.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    signingPacket: { findFirst: m.find },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        signingPacket: { updateMany: m.cas },
        envelope: { create: m.create },
        envelopeEvent: { create: m.event },
      }),
  },
}));
vi.mock("@/lib/esign/evidence", () => ({ verifiedPreparedPdf: m.verified }));
vi.mock("@/lib/esign/packet-routing", () => ({
  advancePacket: m.advance,
  deliverPacketInvitation: m.deliver,
  recipientBoxes: () => ({ signatureBoxes: [] }),
}));
import { POST } from "@/app/api/esign/packets/[id]/send/route";
const config = {
  documents: [{ id: "doc", name: "Test", pageCount: 1, startPage: 1 }],
  recipients: [
    {
      id: "a",
      name: "Alice Test",
      email: "alice@example.test",
      action: "SIGN",
      order: 1,
    },
    {
      id: "b",
      name: "Bob Test",
      email: "bob@example.test",
      action: "SIGN",
      order: 2,
    },
    {
      id: "c",
      name: "Copy Recipient",
      email: "copy@example.test",
      action: "COPY",
      order: 3,
    },
  ],
  fields: ["a", "b"].map((recipientId) => ({
    id: recipientId,
    recipientId,
    kind: "signature",
    page: 1,
    x: 40,
    y: 50,
    width: 120,
    height: 30,
    required: true,
  })),
  subject: "Test",
  message: "Test",
  reminderDays: 1,
  expiresDays: 30,
};
const packet = {
  id: "p1",
  createdById: "u1",
  name: "Test",
  status: "DRAFT",
  revision: 2,
  config,
  preparedPdfPath: "p1.pdf",
  envelopes: [],
};
const request = (body: unknown = { revision: 2 }) =>
  POST(
    new NextRequest("https://example.test/api/esign/packets/p1/send", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "p1" }) },
  );
beforeEach(async () => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ session: { userId: "u1" } });
  m.find.mockResolvedValue(structuredClone(packet));
  m.cas.mockResolvedValue({ count: 1 });
  m.create.mockResolvedValue({ id: "e1" });
  m.advance.mockResolvedValue({ ok: true });
  const pdf = await PDFDocument.create();
  pdf.addPage();
  m.verified.mockResolvedValue({ bytes: Buffer.from(await pdf.save()) });
});
it("requires sender authorization before reading any packet", async () => {
  m.auth.mockResolvedValue({
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  });
  expect((await request()).status).toBe(401);
  expect(m.find).not.toHaveBeenCalled();
});
it("scopes the packet lookup to the logged-in sender", async () => {
  m.find.mockResolvedValue(null);
  expect((await request()).status).toBe(404);
  expect(m.find).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "p1", createdById: "u1" } }),
  );
});
it("rejects stale revisions without creating envelopes or sending email", async () => {
  expect((await request({ revision: 1 })).status).toBe(409);
  expect(m.create).not.toHaveBeenCalled();
  expect(m.advance).not.toHaveBeenCalled();
});
it("creates signer envelopes with distinct tokens; copy recipients do not sign", async () => {
  expect((await request()).status).toBe(200);
  expect(m.create).toHaveBeenCalledTimes(2);
  const first = m.create.mock.calls[0][0].data,
    second = m.create.mock.calls[1][0].data;
  expect(first.status).toBe("DRAFT");
  expect(first.routingOrder).toBe(1);
  expect(second.routingOrder).toBe(2);
  expect(first.signingToken).not.toBe(second.signingToken);
  expect(first.signingToken).toHaveLength(64);
  expect(m.advance).toHaveBeenCalledExactlyOnceWith("p1");
});
it("a concurrent send losing the compare-and-set cannot create duplicate invitations", async () => {
  m.cas.mockResolvedValue({ count: 0 });
  expect((await request()).status).toBe(409);
  expect(m.create).not.toHaveBeenCalled();
  expect(m.advance).not.toHaveBeenCalled();
});
it("rejects missing signature placement before changing packet state", async () => {
  m.find.mockResolvedValue({ ...packet, config: { ...config, fields: [] } });
  expect((await request()).status).toBe(400);
  expect(m.cas).not.toHaveBeenCalled();
});
it("preserves a saved packet when delivery fails, and permits retry without new envelopes", async () => {
  m.advance.mockResolvedValue({ ok: false });
  expect((await request()).status).toBe(502);
  m.find.mockResolvedValue({
    ...packet,
    status: "SENT",
    envelopes: [{ id: "e1", status: "SENT" }],
  });
  m.deliver.mockResolvedValue({ ok: true });
  m.create.mockClear();
  expect((await request({ retry: true })).status).toBe(200);
  expect(m.deliver).toHaveBeenCalledWith("e1");
  expect(m.create).not.toHaveBeenCalled();
});
