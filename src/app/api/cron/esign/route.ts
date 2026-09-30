import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/esign/evidence";
import { runSigningJobs } from "@/lib/esign/reminders";
export async function POST(req: NextRequest) {
  const supplied = req.headers.get("x-esign-job-key") ?? "";
  const expected = process.env.ESIGN_INTERNAL_JOB_KEY;
  const cron = process.env.CRON_SECRET;
  const valid =
    (expected && safeEqual(supplied, expected)) ||
    (cron && safeEqual(req.headers.get("x-cron-secret") ?? "", cron));
  if (!valid)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runSigningJobs());
}
