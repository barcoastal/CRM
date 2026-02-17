import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createDocumentSchema } from "@/lib/validations/payment";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const opportunity = await prisma.opportunity.findUnique({ where: { id } });
  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const where: Record<string, unknown> = { opportunityId: id };
  if (type) where.type = type;

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(documents);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const opportunity = await prisma.opportunity.findUnique({ where: { id } });
  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = createDocumentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const document = await prisma.document.create({
    data: {
      opportunityId: id,
      name: data.name,
      type: data.type,
      filePath: data.filePath,
      fileSize: data.fileSize ?? null,
      uploadedById: session.user!.id!,
    },
    include: {
      uploadedBy: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(document, { status: 201 });
}
