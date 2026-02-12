import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLeadSchema } from "@/lib/validations/lead";

export async function POST(request: NextRequest) {
  // Authenticate via API key
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.LEAD_INGEST_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json(
      { error: "Unauthorized: invalid or missing API key" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Default source to "API" if not provided
  const payload =
    typeof body === "object" && body !== null
      ? { source: "OTHER", ...body }
      : body;

  const parsed = createLeadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const lead = await prisma.lead.create({
    data: {
      businessName: data.businessName,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email || null,
      ein: data.ein || null,
      industry: data.industry || null,
      annualRevenue:
        typeof data.annualRevenue === "number" ? data.annualRevenue : null,
      totalDebtEst:
        typeof data.totalDebtEst === "number" ? data.totalDebtEst : null,
      source: data.source,
      status: "NEW",
      notes: data.notes || null,
      assignedToId: data.assignedToId || null,
    },
  });

  return NextResponse.json(
    { id: lead.id, businessName: lead.businessName, status: lead.status },
    { status: 201 }
  );
}
