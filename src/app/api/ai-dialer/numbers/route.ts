import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const schema = z.object({
  phoneNumber: z.string().regex(/^\+1\d{10}$/, "Use US E.164 format, for example +12125551234"),
  state: z.string().length(2).transform((v) => v.toUpperCase()).nullable().optional(),
  retellNumberId: z.string().optional(),
  label: z.string().max(100).optional(),
  priority: z.number().int().min(0).max(100).default(0),
});

export async function GET() {
  const auth = await requireAuthOrRespond("Integration.Manage");
  if ("response" in auth) return auth.response;
  return NextResponse.json({ numbers: await prisma.aiOutboundNumber.findMany({ orderBy: [{ state: "asc" }, { priority: "desc" }] }) });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthOrRespond("Integration.Manage");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid caller ID", details: parsed.error.flatten() }, { status: 400 });
  const number = await prisma.aiOutboundNumber.upsert({
    where: { phoneNumber: parsed.data.phoneNumber },
    create: parsed.data,
    update: { ...parsed.data, isActive: true },
  });
  return NextResponse.json({ number }, { status: 201 });
}
