import { describe, it, expect } from "vitest";
import {
  nextDraftStatus,
  DraftTransitionError,
  isTerminal,
  computeNextRetryDate,
  shouldRetry,
} from "../../src/lib/draft-state-machine";

describe("nextDraftStatus", () => {
  it("SCHEDULED + RUN → PROCESSING", () => {
    expect(nextDraftStatus("SCHEDULED", { type: "RUN" })).toBe("PROCESSING");
  });
  it("SCHEDULED + CANCEL → CANCELLED", () => {
    expect(nextDraftStatus("SCHEDULED", { type: "CANCEL" })).toBe("CANCELLED");
  });
  it("PROCESSING + WEBHOOK_SUCCESS → SUCCESS", () => {
    expect(nextDraftStatus("PROCESSING", { type: "WEBHOOK_SUCCESS" })).toBe("SUCCESS");
  });
  it("PROCESSING + WEBHOOK_FAILURE → FAILED", () => {
    expect(nextDraftStatus("PROCESSING", { type: "WEBHOOK_FAILURE", returnCode: "R01" })).toBe("FAILED");
  });
  it("FAILED + SCHEDULE_RETRY → RETRYING", () => {
    expect(nextDraftStatus("FAILED", { type: "SCHEDULE_RETRY" })).toBe("RETRYING");
  });
  it("RETRYING + RUN → PROCESSING", () => {
    expect(nextDraftStatus("RETRYING", { type: "RUN" })).toBe("PROCESSING");
  });
  it("rejects invalid transitions", () => {
    expect(() => nextDraftStatus("SCHEDULED", { type: "WEBHOOK_SUCCESS" })).toThrow(DraftTransitionError);
    expect(() => nextDraftStatus("SUCCESS", { type: "RUN" })).toThrow(DraftTransitionError);
    expect(() => nextDraftStatus("CANCELLED", { type: "RUN" })).toThrow(DraftTransitionError);
  });
});

describe("isTerminal", () => {
  it("SUCCESS and CANCELLED are terminal", () => {
    expect(isTerminal("SUCCESS")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
  });
  it("FAILED is not terminal (can retry)", () => {
    expect(isTerminal("FAILED")).toBe(false);
  });
  it("SCHEDULED / PROCESSING / RETRYING are not terminal", () => {
    expect(isTerminal("SCHEDULED")).toBe(false);
    expect(isTerminal("PROCESSING")).toBe(false);
    expect(isTerminal("RETRYING")).toBe(false);
  });
});

describe("computeNextRetryDate", () => {
  it("returns null when max attempts reached", () => {
    expect(
      computeNextRetryDate({
        attemptNumber: 3,
        maxAttempts: 3,
        lastFailureDate: new Date("2026-01-15"),
      }),
    ).toBeNull();
  });

  it("adds 5 business days from a Wednesday → following Wednesday", () => {
    // Wednesday Jan 14 + 5 business days = Wednesday Jan 21
    const d = computeNextRetryDate({
      attemptNumber: 1,
      maxAttempts: 3,
      lastFailureDate: new Date("2026-01-14"),
    });
    expect(d).not.toBeNull();
    expect(d!.toISOString().substring(0, 10)).toBe("2026-01-21");
  });

  it("skips weekends — Friday Jan 16 + 5 BD = Friday Jan 23", () => {
    const d = computeNextRetryDate({
      attemptNumber: 1,
      maxAttempts: 3,
      lastFailureDate: new Date("2026-01-16"),
    });
    expect(d).not.toBeNull();
    expect(d!.toISOString().substring(0, 10)).toBe("2026-01-23");
  });
});

describe("shouldRetry", () => {
  it("allows retry when attempts left", () => {
    expect(shouldRetry({ attemptNumber: 1, maxAttempts: 3 })).toBe(true);
    expect(shouldRetry({ attemptNumber: 2, maxAttempts: 3 })).toBe(true);
  });
  it("blocks retry when max reached", () => {
    expect(shouldRetry({ attemptNumber: 3, maxAttempts: 3 })).toBe(false);
  });
  it("blocks retry for hard ACH return codes", () => {
    expect(shouldRetry({ attemptNumber: 1, maxAttempts: 3, returnCode: "R02" })).toBe(false);
    expect(shouldRetry({ attemptNumber: 1, maxAttempts: 3, returnCode: "R04" })).toBe(false);
    expect(shouldRetry({ attemptNumber: 1, maxAttempts: 3, returnCode: "R20" })).toBe(false);
  });
  it("allows retry for soft returns (R01 = insufficient funds)", () => {
    expect(shouldRetry({ attemptNumber: 1, maxAttempts: 3, returnCode: "R01" })).toBe(true);
  });
});
