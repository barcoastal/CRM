import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LivePaymentGrid, type LiveDraftRow } from "@/components/program-plans/live-payment-grid";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("payment calendar dates", () => {
  it.each([
    ["2026-10-01T00:00:00.000Z", "10/01/2026", "WIRE", "SUCCESS"],
    ["2026-03-06T00:00:00.000Z", "03/06/2026", "REGULAR", "SCHEDULED"],
    ["2026-03-13T00:00:00.000Z", "03/13/2026", "REGULAR", "SCHEDULED"],
  ])("shows %s as its saved calendar date", (scheduledDate, visibleDate, kind, status) => {
    const draft: LiveDraftRow = {
      id: "payment", scheduledDate, kind, status, amount: 100,
      feeProgram: 0, feeRetainer: 0, feeSetup: 0, feeBank: 0,
      feeService: 0, feeLegal: 0, escrowAmount: 100,
      splitGroupId: null, splitIndex: null, processorSyncStatus: "NOT_REQUIRED",
    };
    const html = renderToStaticMarkup(createElement(LivePaymentGrid, { programPlanId: "plan", drafts: [draft] }));
    expect(html).toContain(visibleDate);
  });
});
