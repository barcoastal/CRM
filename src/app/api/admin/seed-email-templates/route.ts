/**
 * Seeds the standard debt-settlement email templates.
 *   POST /api/admin/seed-email-templates
 * Auth: requires Setup.Admin permission.
 */
import { NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { seedEmailTemplates } from "@/lib/seed-email-templates";

export async function POST() {
  const r = await requireAuthOrRespond("Setup.Admin");
  if ("response" in r) return r.response;
  const result = await seedEmailTemplates();
  return NextResponse.json({ ok: true, ...result });
}
