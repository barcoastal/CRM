/**
 * TEMPORARY admin diagnostic — discover whether SAS exposes a charge/create-debit
 * WRITE method. Calls candidate method names with EMPTY bodies only, so no
 * customer/amount is ever sent and nothing can be charged; we just read which
 * methods exist vs "unknown method" from the response. Remove after mapping.
 *
 *   GET /api/payment-processors/sas/probe-write
 */
import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { sasProbe } from "@/lib/payment-processors/sas";

const CANDIDATES = [
  "CreateDebit",
  "AddDebit",
  "InsertDebit",
  "NewDebit",
  "ProcessDebit",
  "SubmitDebit",
  "RunDebit",
  "ScheduleDebit",
  "CreateDebitSchedule",
  "AddDebitSchedule",
  "CreateOneTimeDebit",
  "CreateAdHocDebit",
  "CreatePayment",
  "ProcessPayment",
  "AddPayment",
  "ChargeCustomer",
  "ChargeNow",
  "ProcessNow",
  "RetryDebit",
  "ReprocessDebit",
];

export async function GET() {
  const r = await requireAuthOrRespond("Modify.AllData");
  if ("response" in r) return r.response;

  const out: Record<string, { ok: boolean; message: string | null }> = {};
  for (const method of CANDIDATES) {
    try {
      // EMPTY body — never send a customer id or amount.
      const res = await sasProbe(method, {});
      out[method] = { ok: res.ok, message: res.message };
    } catch (e) {
      out[method] = { ok: false, message: e instanceof Error ? e.message.slice(0, 200) : String(e) };
    }
  }
  return NextResponse.json(out);
}
