import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { listRegistry } from "@/lib/dashboards/queries";

export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  return NextResponse.json({ items: listRegistry() });
}
