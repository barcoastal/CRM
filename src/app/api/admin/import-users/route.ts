/**
 * Bulk-import users from a Salesforce CSV export.
 *
 *   POST /api/admin/import-users
 *     body: { csv: "..." } (multipart or JSON)
 *
 * Auth: Setup.Admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { importUsersFromCSV } from "@/lib/user-import";

export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("Setup.Admin");
  if ("response" in r) return r.response;

  const ct = request.headers.get("content-type") ?? "";
  let csv = "";

  if (ct.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { csv?: string };
    csv = body.csv ?? "";
  } else if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (file instanceof File) {
      csv = await file.text();
    } else {
      csv = (form.get("csv") as string) ?? "";
    }
  } else {
    csv = await request.text();
  }

  if (!csv.trim()) {
    return NextResponse.json({ error: "csv body required" }, { status: 400 });
  }

  const result = await importUsersFromCSV(csv);
  return NextResponse.json({ ok: true, ...result });
}
