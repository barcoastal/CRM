import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { addSuppression, normalizePhone } from "@/lib/dnc";

/**
 * Bulk DNC import — CSV or newline-separated phone numbers.
 * One phone per line; extra columns ignored.
 *
 *   POST /api/dnc/import
 *   Body: multipart with "file", OR plain text body, OR JSON { phones: [], reason, source }
 */
export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const contentType = request.headers.get("content-type") ?? "";

  let phones: string[] = [];
  let reason = "Imported";
  let source: string | undefined;

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    phones = Array.isArray(body.phones) ? body.phones : [];
    if (body.reason) reason = body.reason;
    if (body.source) source = body.source;
  } else if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (file instanceof File) {
      const text = await file.text();
      phones = parseCsv(text);
      source = `CSV: ${file.name}`;
    }
    if (typeof form.get("reason") === "string") reason = form.get("reason") as string;
  } else {
    const text = await request.text();
    phones = parseCsv(text);
  }

  const added: string[] = [];
  const skipped: string[] = [];
  for (const p of phones) {
    const key = normalizePhone(p);
    if (key.length < 10) {
      skipped.push(p);
      continue;
    }
    try {
      const out = await addSuppression({
        phone: key,
        reason,
        source,
        addedById: session.userId,
      });
      if (out.alreadyOnList) skipped.push(p);
      else added.push(key);
    } catch {
      skipped.push(p);
    }
  }

  return NextResponse.json({ ok: true, added: added.length, skipped: skipped.length });
}

function parseCsv(text: string): string[] {
  return text
    .split(/[\r\n]+/)
    .map((line) => line.split(",")[0]?.trim() ?? "")
    .filter((s) => s.length > 0 && !/^phone$/i.test(s));
}
