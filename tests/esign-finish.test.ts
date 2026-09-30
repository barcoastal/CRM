import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
const m = vi.hoisted(() => ({
  find: vi.fn(),
  event: vi.fn(),
  update: vi.fn(),
  commit: vi.fn(),
  events: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    envelope: { findUnique: m.find, update: m.update },
    envelopeEvent: { findFirst: m.event, create: vi.fn() },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        envelope: { updateMany: m.commit },
        envelopeEvent: { createMany: m.events },
      }),
  },
}));
vi.mock("@/lib/esign/send-email", () => ({
  sendESignEmail: m.send,
  renderSignedCopyHtml: () => "",
  renderSenderNotificationHtml: () => "",
}));
vi.mock("@/lib/notifications/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/opportunity-stage", () => ({ advanceOppStage: vi.fn() }));
import { POST } from "@/app/api/esign/envelopes/by-token/[token]/finish/route";
import { saveEnvelopePdf } from "@/lib/esign/storage";
import {
  sha256,
  signingFieldsHash,
  signProof,
  proofCookie,
} from "@/lib/esign/evidence";
import { DISCLOSURE_VERSION } from "@/lib/esign/disclosure";
let dir: string;
let cookie: string;
let env: Record<string, unknown>;
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const body = {
  signature: png,
  fullName: "Jane Smith",
  appliedFieldIds: ["signature-0", "initial-0"],
  consent: true,
  disclosureVersion: DISCLOSURE_VERSION,
  textValues: { 0: "Owner" },
  dateValues: { 0: "2026-09-30" },
};
const request = (overrides = {}, auth = true) =>
  POST(
    new NextRequest(
      "http://localhost/api/esign/envelopes/by-token/test/finish",
      {
        method: "POST",
        headers: auth ? { cookie } : {},
        body: JSON.stringify({ ...body, ...overrides }),
      },
    ),
    { params: Promise.resolve({ token: "test" }) },
  );
beforeEach(async () => {
  vi.clearAllMocks();
  dir = await mkdtemp(path.join(tmpdir(), "esign-finish-"));
  vi.stubEnv("AUTH_SECRET", "test-secret");
  for (const k of [
    "ESIGN_ENVELOPES_DIR",
    "ESIGN_SIGNED_DIR",
    "ESIGN_TEMPLATES_DIR",
  ])
    vi.stubEnv(k, dir);
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = Buffer.from(await pdf.save());
  const filename = await saveEnvelopePdf(bytes, "e1");
  env = {
    id: "e1",
    status: "VIEWED",
    viewedAt: new Date(),
    expiresAt: null,
    signerName: "Old Name",
    signerEmail: "jane@example.test",
    signingToken: "test",
    documentName: "Test document",
    preparedPdfPath: filename,
    signatureBoxes: [{ page: 1, x: 40, y: 40, width: 100, height: 30 }],
    initialBoxes: [],
    textBoxes: [
      { page: 1, x: 40, y: 80, width: 100, height: 20, label: "Title" },
    ],
    dateBoxes: [{ page: 1, x: 40, y: 100, width: 100, height: 20 }],
    checkboxBoxes: [],
  };
  cookie = `${proofCookie("e1")}=${signProof({ envelopeId: "e1", email: "jane@example.test", documentHash: sha256(bytes), fieldsHash: signingFieldsHash(env), verifiedAt: new Date().toISOString(), expires: Date.now() + 60000, eventId: "v1" })}`;
  m.find.mockImplementation(async () => env);
  m.event.mockResolvedValue({ id: "v1" });
  m.commit.mockResolvedValue({ count: 1 });
  m.send.mockResolvedValue({ ok: true });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});
it("rejects unsigned consent and missing required fields at the API", async () => {
  expect((await request({ consent: false })).status).toBe(400);
  expect((await request({ textValues: {} })).status).toBe(400);
  expect(m.commit).not.toHaveBeenCalled();
  expect(m.send).not.toHaveBeenCalled();
});
it("rejects an expired envelope and missing email proof", async () => {
  expect((await request({}, false)).status).toBe(401);
  env.expiresAt = new Date(0);
  expect((await request()).status).toBe(400);
  expect(m.send).not.toHaveBeenCalled();
});
it("completes with retained consent, correct asserted signer, hashes, and a readable certificate", async () => {
  const r = await request();
  expect(r.status).toBe(200);
  const records = m.events.mock.calls[0][0].data;
  expect(records.map((r: { eventType: string }) => r.eventType)).toEqual([
    "CONSENT_ACCEPTED",
    "SIGNED",
    "COMPLETED",
  ]);
  expect(JSON.parse(records[0].details).fullName).toBe("Jane Smith");
  const evidence = JSON.parse(records[2].details);
  const bytes = await readFile(path.join(dir, evidence.signedFilename));
  expect(sha256(bytes)).toBe(evidence.signedSha256);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  if (process.env.ESIGN_QA_PDF)
    await writeFile(process.env.ESIGN_QA_PDF, bytes);
});
it("a withdrawal/concurrent completion winning the race prevents completion and all notification side effects", async () => {
  m.commit.mockResolvedValue({ count: 0 });
  expect((await request()).status).toBe(409);
  expect(m.events).not.toHaveBeenCalled();
  expect(m.send).not.toHaveBeenCalled();
});
