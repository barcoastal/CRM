import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), opportunity: vi.fn(), user: vi.fn(), send: vi.fn(), task: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: m.auth }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: m.access }));
vi.mock("@/lib/document-request", () => ({ appBaseUrl: () => "https://crm.example.test" }));
vi.mock("@/lib/esign/send-email", () => ({ sendESignEmail: m.send }));
vi.mock("@/lib/prisma", () => ({ prisma: { opportunity: { findUnique: m.opportunity }, user: { findUnique: m.user }, task: { upsert: m.task } } }));
import { GET, POST } from "@/app/api/opportunities/[id]/quote/route";
const params = { params: Promise.resolve({ id: "opp" }) };
const body = { recipientEmail: "client@example.test", recipientName: "Client", requestId: "718cf671-3f70-4055-8758-158f345176e4" };
const opp = { id: "opp", debts: [{ originalBalance: 100000 }], currentWeeklyPayment: 5000, oppEmail: "client@example.test", paymentCalculations: [{ id: "calc", totalDebt: 100000, programFeePeriod: 6, firstPaymentDate: new Date("2026-10-02"), scheduleJson: null }] };
const get = () => GET(new NextRequest("http://localhost/api/quote"), params);
const post = (data: unknown) => POST(new NextRequest("http://localhost/api/quote", { method: "POST", body: JSON.stringify(data) }), params);
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ session: { userId: "rep", email: "rep@example.test" } });
  m.access.mockResolvedValue(true); m.opportunity.mockResolvedValue(opp);
  m.user.mockResolvedValue({ name: "Rep" }); m.send.mockResolvedValue({ ok: true }); m.task.mockResolvedValue({});
});
it("previews the saved schedule without sending or writing activity", async () => {
  const response = await get(); const data = await response.json();
  expect(response.status).toBe(200); expect(data.revision).toHaveLength(64);
  expect(data.figures.paymentSchedule[0].date).toBe("2026-10-02");
  expect(m.send).not.toHaveBeenCalled(); expect(m.task).not.toHaveBeenCalled();
});
it("rejects a send if the calculation changed since preview", async () => {
  const { revision } = await (await get()).json();
  m.opportunity.mockResolvedValue({ ...opp, paymentCalculations: [{ ...opp.paymentCalculations[0], id: "new-calc", totalDebt: 120000 }] });
  expect((await post({ ...body, revision })).status).toBe(409);
  expect(m.send).not.toHaveBeenCalled(); expect(m.task).not.toHaveBeenCalled();
});
it("does not log a failed email as sent", async () => {
  const { revision } = await (await get()).json(); m.send.mockResolvedValue({ ok: false, error: "test provider failure" });
  expect((await post({ ...body, revision })).status).toBe(502); expect(m.task).not.toHaveBeenCalled();
});
it("uses the same provider and activity key for an identical retry", async () => {
  const { revision } = await (await get()).json();
  expect((await post({ ...body, revision })).status).toBe(200);
  expect((await post({ ...body, revision })).status).toBe(200);
  expect(m.send.mock.calls[0][0].idempotencyKey).toBe(m.send.mock.calls[1][0].idempotencyKey);
  expect(m.task.mock.calls[0][0].where.id).toBe(m.task.mock.calls[1][0].where.id);
  expect(m.send.mock.calls[0][0].html).toContain("Estimated payment schedule");
});
it("keeps the quote inaccessible when record access is denied", async () => {
  m.access.mockResolvedValue(false); expect((await get()).status).toBe(404);
  expect((await post(body)).status).toBe(404); expect(m.send).not.toHaveBeenCalled();
});
it("rejects malformed recipient data without attempting a send", async () => {
  expect((await post({ ...body, recipientEmail: 42 })).status).toBe(400); expect(m.send).not.toHaveBeenCalled();
});

it("uses the same weekly debt obligation fallback as the opportunity summary", async () => {
  m.opportunity.mockResolvedValue({ ...opp, currentWeeklyPayment: null, debts: [{ originalBalance: 100000, paymentAmount: 500, paymentFrequency: "DAILY" }] });
  const data = await (await get()).json(); expect(data.figures.currentWeeklyPayment).toBe(2500);
});
