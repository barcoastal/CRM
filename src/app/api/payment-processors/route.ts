import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { createPaymentProcessorSchema } from "@/lib/validations/payment-processor";

export async function GET(_req: NextRequest) {
  const r = await requireAuthOrRespond("Account.View");
  if ("response" in r) return r.response;
  const items = await prisma.paymentProcessor.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond("Integration.Manage");
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => ({}));
  const parsed = createPaymentProcessorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = await prisma.paymentProcessor.create({ data: parsed.data });
  return NextResponse.json(p, { status: 201 });
}
