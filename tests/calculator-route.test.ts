import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ auth: vi.fn(), access: vi.fn(), opp: vi.fn(), transaction: vi.fn(), latest: vi.fn(), create: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ requireAuthOrRespond: m.auth }));
vi.mock("@/lib/record-access", () => ({ canAccessRecord: m.access }));
vi.mock("@/lib/prisma", () => ({ prisma: { opportunity: { findUnique: m.opp }, $transaction: m.transaction } }));
import { POST } from "@/app/api/opportunities/[id]/calculator/route";
const state = { version: 1, termMonths: 6, firstPaymentDate: "2026-10-02", weeklyPaymentDay: "Friday", paymentProcessor: "SAS Processor", splitRows: null, skipped: [2], rowEdits: {}, extraRows: [], moveDrafts: false };
const body = { totalDebt: 100000, citadelFee: 145, expectedCalculationId: "old", scheduleState: state };
const post = (data: unknown = body) => POST(new NextRequest("http://localhost/api/calculator", { method: "POST", body: JSON.stringify(data) }), { params: Promise.resolve({ id: "opp" }) });
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ session: { userId: "rep" } }); m.access.mockResolvedValue(true); m.opp.mockResolvedValue({ id: "opp" });
  m.latest.mockResolvedValue({ id: "old" }); m.create.mockResolvedValue({ id: "new", savedAt: new Date("2026-10-01") });
  m.transaction.mockImplementation(fn => fn({ opportunityPaymentCalculation: { findFirst: m.latest, create: m.create }, auditLog: { create: m.audit } }));
});
it("saves splits, skip settings and date/term from the validated state atomically", async () => {
  expect((await post({ ...body, programFeePeriod: 30, firstPaymentDate: "2030-01-01" })).status).toBe(200);
  const data = m.create.mock.calls[0][0].data;
  expect(data.programFeePeriod).toBe(6); expect(data.firstPaymentDate.toISOString().slice(0, 10)).toBe("2026-10-02");
  expect(data.scheduleJson).toEqual(state); expect(m.audit).toHaveBeenCalledOnce();
});
it("rejects a stale calculation without overwriting it", async () => {
  m.latest.mockResolvedValue({ id: "someone-elses-save" });
  expect((await post()).status).toBe(409); expect(m.create).not.toHaveBeenCalled();
});
it("rejects an amount edit below the allocated fees", async () => {
  expect((await post({ ...body, scheduleState: { ...state, rowEdits: { "2": { date: "2026-10-09", amount: 1 } } } })).status).toBe(400);
  expect(m.transaction).not.toHaveBeenCalled();
});
it.each([null, { ...body, totalDebt: -1 }, { ...body, scheduleState: { ...state, firstPaymentDate: "bad" } }])("rejects invalid calculation data", async data => {
  expect((await post(data)).status).toBe(400); expect(m.create).not.toHaveBeenCalled();
});
it("checks edit permission and record scope before saving", async () => {
  m.access.mockResolvedValue(false); expect((await post()).status).toBe(404);
  expect(m.auth).toHaveBeenCalledWith("Opportunity.Edit"); expect(m.create).not.toHaveBeenCalled();
});
