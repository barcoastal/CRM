/**
 * Create a Five9 list and (optionally) seed it with a single number.
 *
 *   POST /api/dialer/five9/admin/create-list
 *   Body: { name: string, phone?: string, firstName?: string, lastName?: string }
 *
 * Returns: { ok, name, addedPhone? }
 *
 * Auth: requires Lead.Edit (admin-level usage).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createList, addRecordToList } from "@/lib/five9/admin-api";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

export async function POST(request: NextRequest) {
  const r = await requireAuthOrRespond("Lead.Edit");
  if ("response" in r) return r.response;

  let body: { name?: string; phone?: string; firstName?: string; lastName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  let listCreated = false;
  try {
    await createList(body.name);
    listCreated = true;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "fail";
    // "list already exists" is fine — keep going to add the record
    if (!/already exist|duplicate/i.test(msg)) {
      return NextResponse.json(
        { ok: false, step: "createList", error: msg },
        { status: 502 },
      );
    }
  }

  let addedPhone: string | undefined;
  if (body.phone) {
    const phone = normalizePhone(body.phone);
    try {
      await addRecordToList({
        listName: body.name,
        phone,
        firstName: body.firstName ?? "",
        lastName: body.lastName ?? "",
      });
      addedPhone = phone;
    } catch (e: unknown) {
      return NextResponse.json(
        {
          ok: false,
          step: "addRecordToList",
          listCreated: true,
          name: body.name,
          error: e instanceof Error ? e.message : "fail",
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: true, name: body.name, listCreated, addedPhone });
}
