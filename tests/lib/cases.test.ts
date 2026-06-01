import { describe, it, expect } from "vitest";
import {
  nextEscalationLevel,
  isTerminalCaseStatus,
  isCaseRecordType,
  CASE_STATUSES,
  ESCALATION_LEVELS,
} from "../../src/lib/record-types";

describe("nextEscalationLevel", () => {
  it("L1 → L2", () => {
    expect(nextEscalationLevel("L1")).toBe("L2");
  });
  it("L2 → L3", () => {
    expect(nextEscalationLevel("L2")).toBe("L3");
  });
  it("L3 → null (cannot escalate further)", () => {
    expect(nextEscalationLevel("L3")).toBeNull();
  });
  it("unknown levels return null", () => {
    expect(nextEscalationLevel("XYZ")).toBeNull();
  });
});

describe("isTerminalCaseStatus", () => {
  it("RESOLVED is terminal", () => {
    expect(isTerminalCaseStatus("RESOLVED")).toBe(true);
  });
  it("CLOSED is terminal", () => {
    expect(isTerminalCaseStatus("CLOSED")).toBe(true);
  });
  it("NEW / OPEN / IN_PROGRESS / WAITING_ON_CUSTOMER / ESCALATED are not terminal", () => {
    expect(isTerminalCaseStatus("NEW")).toBe(false);
    expect(isTerminalCaseStatus("OPEN")).toBe(false);
    expect(isTerminalCaseStatus("IN_PROGRESS")).toBe(false);
    expect(isTerminalCaseStatus("WAITING_ON_CUSTOMER")).toBe(false);
    expect(isTerminalCaseStatus("ESCALATED")).toBe(false);
  });
});

describe("isCaseRecordType", () => {
  it("accepts known record types", () => {
    expect(isCaseRecordType("SKIP_PAYMENT")).toBe(true);
    expect(isCaseRecordType("PAYMENT_ISSUE")).toBe(true);
    expect(isCaseRecordType("CANCELLATION")).toBe(true);
  });
  it("rejects unknown record types", () => {
    expect(isCaseRecordType("REFUND_REQUEST")).toBe(false);
  });
});

describe("CASE_STATUSES + ESCALATION_LEVELS exports", () => {
  it("has the canonical 7 statuses", () => {
    expect(CASE_STATUSES.length).toBe(7);
  });
  it("has 3 escalation levels", () => {
    expect(ESCALATION_LEVELS).toEqual(["L1", "L2", "L3"]);
  });
});
