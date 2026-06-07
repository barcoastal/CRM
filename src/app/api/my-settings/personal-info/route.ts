import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { auditWrite } from "@/lib/audit";

const Schema = z.object({
  firstName: z.string().trim().max(80).optional().default(""),
  middleName: z.string().trim().max(80).optional().default(""),
  lastName: z.string().trim().max(80).optional().default(""),
  suffix: z.string().trim().max(40).optional().default(""),
  alias: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().email().max(254),
  // username is read-only, accept but ignore
  username: z.string().optional(),
  nickname: z.string().trim().max(40).optional().default(""),
  title: z.string().trim().max(120).optional().default(""),
  companyDisplay: z.string().trim().max(120).optional().default(""),
  department: z.string().trim().max(120).optional().default(""),
  division: z.string().trim().max(120).optional().default(""),
  extension: z.string().trim().max(40).optional().default(""),
  fax: z.string().trim().max(40).optional().default(""),
  mobile: z.string().trim().max(40).optional().default(""),
  country: z.string().trim().max(80).optional().default(""),
  street: z.string().trim().max(255).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  state: z.string().trim().max(80).optional().default(""),
  postalCode: z.string().trim().max(20).optional().default(""),
});

function nameFromParts(first: string, middle: string, last: string, suffix: string): string {
  return [first, middle, last, suffix].map((s) => s.trim()).filter(Boolean).join(" ") || first || "User";
}

function emptyToNull(v: string | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function POST(req: Request) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { session } = r;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const v = parsed.data;

  const before = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      middleName: true,
      suffix: true,
      alias: true,
      nickname: true,
      title: true,
      companyDisplay: true,
      department: true,
      division: true,
      extension: true,
      fax: true,
      mobile: true,
      country: true,
      street: true,
      city: true,
      state: true,
      postalCode: true,
    },
  });

  if (!before) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const fullName = nameFromParts(v.firstName, v.middleName, v.lastName, v.suffix);

  const data = {
    name: fullName,
    email: v.email.trim(),
    middleName: emptyToNull(v.middleName),
    suffix: emptyToNull(v.suffix),
    alias: emptyToNull(v.alias),
    nickname: emptyToNull(v.nickname),
    title: emptyToNull(v.title),
    companyDisplay: emptyToNull(v.companyDisplay),
    department: emptyToNull(v.department),
    division: emptyToNull(v.division),
    extension: emptyToNull(v.extension),
    fax: emptyToNull(v.fax),
    mobile: emptyToNull(v.mobile),
    country: emptyToNull(v.country),
    street: emptyToNull(v.street),
    city: emptyToNull(v.city),
    state: emptyToNull(v.state),
    postalCode: emptyToNull(v.postalCode),
  };

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id: session.userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        middleName: true,
        suffix: true,
        alias: true,
        nickname: true,
        title: true,
        companyDisplay: true,
        department: true,
        division: true,
        extension: true,
        fax: true,
        mobile: true,
        country: true,
        street: true,
        city: true,
        state: true,
        postalCode: true,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique") || msg.includes("unique")) {
      return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not save changes." }, { status: 500 });
  }

  await auditWrite({
    userId: session.userId,
    entity: "User",
    entityId: session.userId,
    action: "UPDATE",
    before: before as Record<string, unknown>,
    after: updated as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true, user: updated });
}
