import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { getAiDialerOverview } from "@/lib/ai-dialer/overview";

export async function GET() {
  const auth = await requireAuthOrRespond("Call.View");
  if ("response" in auth) return auth.response;
  return NextResponse.json(await getAiDialerOverview());
}
