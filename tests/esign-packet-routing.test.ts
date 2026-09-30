import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { PDFDocument } from "pdf-lib";
const m = vi.hoisted(() => ({
  packet: vi.fn(),
  packetUpdate: vi.fn(),
  envUpdate: vi.fn(),
  envFind: vi.fn(),
  event: vi.fn(),
  eventCreate: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/prisma", () => {
  const p = {
    signingPacket: { findUnique: m.packet, update: m.packetUpdate },
    envelope: {
      findUnique: m.envFind,
      update: m.envUpdate,
      updateMany: vi.fn(),
    },
    envelopeEvent: { findFirst: m.event, create: m.eventCreate },
    $executeRaw: vi.fn(),
  };
  return {
    prisma: {
      ...p,
      $transaction: async (fn: (tx: unknown) => unknown) => fn(p),
    },
  };
});
vi.mock("@/lib/esign/packet-email", () => ({ sendPacketInvitation: m.send }));
vi.mock("@/lib/opportunity-stage", () => ({ advanceOppStage: vi.fn() }));
import { advancePacket } from "@/lib/esign/packet-routing";
import { sha256 } from "@/lib/esign/evidence";
const config = {
  documents: [{ id: "d", name: "Test", pageCount: 1, startPage: 1 }],
  recipients: [
    {
      id: "a",
      name: "Alice Test",
      email: "alice@example.test",
      action: "SIGN",
      order: 1,
    },
  ],
  fields: [],
  subject: "Test",
  message: "Test",
  reminderDays: 1,
  expiresDays: 30,
};
let dir: string, bytes: Buffer;
const previous = {
  id: "e1",
  status: "COMPLETED",
  routingOrder: 1,
  signedDocumentUrl: "previous.pdf",
};
const next = { id: "e2", status: "DRAFT", routingOrder: 2 };
beforeEach(async () => {
  vi.clearAllMocks();
  dir = await mkdtemp(path.join(tmpdir(), "esign-routing-"));
  for (const k of [
    "ESIGN_ENVELOPES_DIR",
    "ESIGN_SIGNED_DIR",
    "ESIGN_TEMPLATES_DIR",
  ])
    vi.stubEnv(k, dir);
  const pdf = await PDFDocument.create();
  pdf.addPage();
  bytes = Buffer.from(await pdf.save());
  await writeFile(path.join(dir, "previous.pdf"), bytes);
  m.packet.mockResolvedValue({
    id: "p",
    status: "SENT",
    config,
    envelopes: [previous, next],
  });
  m.event.mockResolvedValue({
    details: JSON.stringify({ signedSha256: sha256(bytes) }),
  });
  m.envFind.mockResolvedValue({
    id: "e2",
    status: "SENT",
    signerEmail: "alice@example.test",
    signingToken: "test",
    packet: { config },
    createdBy: { name: "Sender", email: "sender@example.test" },
  });
  m.send.mockResolvedValue({ ok: true });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});
it("passes the exact previous signed PDF to the next signer before inviting them", async () => {
  await advancePacket("p");
  expect(await readFile(path.join(dir, "e2.pdf"))).toEqual(bytes);
  expect(m.envUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "e2" },
      data: expect.objectContaining({
        status: "SENT",
        preparedPdfPath: "e2.pdf",
      }),
    }),
  );
  expect(m.send).toHaveBeenCalledOnce();
});
it("refuses to route a tampered previous document", async () => {
  m.event.mockResolvedValue({
    details: JSON.stringify({ signedSha256: "bad" }),
  });
  await expect(advancePacket("p")).rejects.toThrow("integrity verification");
  expect(m.envUpdate).not.toHaveBeenCalled();
  expect(m.send).not.toHaveBeenCalled();
});
it("never invites the next signer while the current signer is still active", async () => {
  m.packet.mockResolvedValue({
    id: "p",
    status: "SENT",
    config,
    envelopes: [{ ...previous, status: "VIEWED" }, next],
  });
  await advancePacket("p");
  expect(m.envUpdate).not.toHaveBeenCalled();
  expect(m.send).not.toHaveBeenCalled();
});
it("a decline stops subsequent invitations", async () => {
  m.packet.mockResolvedValue({
    id: "p",
    status: "SENT",
    config,
    envelopes: [{ ...previous, status: "DECLINED" }, next],
  });
  await advancePacket("p");
  expect(m.packetUpdate).toHaveBeenCalledWith({
    where: { id: "p" },
    data: { status: "DECLINED" },
  });
  expect(m.send).not.toHaveBeenCalled();
});
