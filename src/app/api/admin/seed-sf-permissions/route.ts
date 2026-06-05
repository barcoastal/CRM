import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { seedSFPermissions } from "@/lib/seed-sf-permissions";

export async function POST() {
  const r = await requireAuthOrRespond("Setup.Admin");
  if ("response" in r) return r.response;
  try {
    const result = await seedSFPermissions();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "fail" }, { status: 500 });
  }
}
