import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "opportunities");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Read");
  if ("response" in r) return r.response;
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const where: Record<string, unknown> = { opportunityId: id };
  if (type) where.type = type;
  const items = await prisma.document.findMany({
    where,
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const opp = await prisma.opportunity.findUnique({ where: { id } });
  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  const type = (form.get("type") as string) || "OTHER";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const dir = path.join(UPLOAD_ROOT, id);
  await fs.mkdir(dir, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${Date.now()}_${safeName}`;
  const filePath = path.join(dir, storedName);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buf);

  const doc = await prisma.document.create({
    data: {
      opportunityId: id,
      name: file.name,
      type,
      filePath: path.relative(process.cwd(), filePath),
      fileSize: buf.byteLength,
      uploadedById: session.userId,
    },
  });

  return NextResponse.json(doc);
}
