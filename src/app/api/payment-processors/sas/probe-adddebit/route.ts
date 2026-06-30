/**
 * TEMPORARY admin diagnostic — map AddDebit's required params WITHOUT charging.
 * Every call uses a deliberately INVALID remote id, so the customer lookup
 * fails and no debit can be created; we only read the validation messages to
 * learn the field names (amount/date/etc.). Remove after mapping.
 *
 *   GET /api/payment-processors/sas/probe-adddebit
 */
import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sasProbe } from "@/lib/payment-processors/sas";

const BOGUS = "PROBE_INVALID_NO_SUCH_CUSTOMER_ZZZ";

export async function GET() {
  const r = await requireAuthOrRespond("Modify.AllData");
  if ("response" in r) return r.response;

  // Progressively add candidate fields; bogus RemoteID guarantees no creation.
  const steps: Array<[string, Record<string, unknown>]> = [
    ["empty", {}],
    ["RemoteID only", { RemoteID: BOGUS }],
    ["+ Amount", { RemoteID: BOGUS, Amount: "1.00" }],
    ["+ Total", { RemoteID: BOGUS, Total: "1.00" }],
    ["+ Amount + DebitDate", { RemoteID: BOGUS, Amount: "1.00", DebitDate: "2030-01-01" }],
    ["+ Amount + Date", { RemoteID: BOGUS, Amount: "1.00", Date: "2030-01-01" }],
    ["+ Amount + ScheduledDate", { RemoteID: BOGUS, Amount: "1.00", ScheduledDate: "2030-01-01" }],
    ["full guess", { RemoteID: BOGUS, Amount: "1.00", DebitDate: "2030-01-01", Description: "probe", Type: "OneTime" }],
  ];

  const out: Record<string, { ok: boolean; message: string | null }> = {};
  for (const [label, body] of steps) {
    try {
      const res = await sasProbe("AddDebit", body);
      out[label] = { ok: res.ok, message: res.message };
    } catch (e) {
      out[label] = { ok: false, message: e instanceof Error ? e.message.slice(0, 200) : String(e) };
    }
  }
  return NextResponse.json({ note: "All calls used an invalid RemoteID; nothing was charged.", results: out });
}
