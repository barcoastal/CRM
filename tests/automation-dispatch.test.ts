import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ beforeInsert: vi.fn(), afterInsert: vi.fn(), beforeUpdate: vi.fn(), afterUpdate: vi.fn(), create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: mocks } }));
vi.mock("@/lib/triggers/registry", () => ({ getTrigger: () => mocks }));
vi.mock("@/lib/flow/executor", () => ({ evaluateAndStartFlows: mocks.dispatch }));
import { triggerCreateArgs, triggerUpdateArgs, makeCtx } from "@/lib/triggers/runner";

beforeEach(() => { vi.resetAllMocks(); mocks.dispatch.mockResolvedValue(undefined); });
describe("record-save dispatch", () => {
  it("validates before writing and dispatches insert exactly once", async () => {
    const row = { id: "lead1", status: "New" };
    mocks.create.mockResolvedValue(row);
    await triggerCreateArgs("lead", { data: { status: "New" } }, makeCtx("actor"));
    expect(mocks.beforeInsert.mock.invocationCallOrder[0]).toBeLessThan(mocks.create.mock.invocationCallOrder[0]);
    expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith("Lead", "INSERT", row);
  });
  it("rejects failed rules without persisting or dispatching", async () => {
    mocks.beforeInsert.mockRejectedValue(new Error("Required field missing"));
    await expect(triggerCreateArgs("lead", { data: {} }, makeCtx("actor"))).rejects.toThrow("Required field missing");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("checks record access and sends both previous and new values", async () => {
    const prev = { id: "lead1", status: "New" }, row = { id: "lead1", status: "Working Lead" };
    mocks.findUnique.mockResolvedValue(prev); mocks.update.mockResolvedValue(row); mocks.findUniqueOrThrow.mockResolvedValue(prev);
    const where = { id: "lead1", AND: [{ assignedToId: "actor" }] };
    await triggerUpdateArgs("lead", { where, data: { status: row.status } }, makeCtx("actor"));
    expect(mocks.findUniqueOrThrow).toHaveBeenCalledWith({ where });
    expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith("Lead", "UPDATE", row, prev);
  });
  it("does not write when the scoped lookup fails", async () => {
    mocks.findUniqueOrThrow.mockRejectedValue(new Error("Not found"));
    await expect(triggerUpdateArgs("lead", { where: { id: "lead1" }, data: {} }, makeCtx("actor"))).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
