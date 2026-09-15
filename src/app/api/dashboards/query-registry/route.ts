import { analyticsApiAccess } from "@/lib/analytics-access";
import { NextResponse } from "next/server";
import { listRegistry } from "@/lib/dashboards/queries";

export async function GET() {
  const gate = await analyticsApiAccess("Dashboards.View");
  if ("response" in gate) return gate.response;
  return NextResponse.json({ items: listRegistry() });
}
