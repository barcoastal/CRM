import { canAccessRecord } from "@/lib/record-access";
import { ssnSafeJson } from "@/lib/ssn-safe-json";
import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { uploadRoot } from "@/lib/upload-storage";


const UPLOAD_ROOT = uploadRoot("opportunities");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.View");
  if ("response" in r) return r.response;
  const { id } = await params;
  if (!await canAccessRecord("opportunity", id)) return Response.json({ error: "Not found" }, { status: 404 });
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const where: Record<string, unknown> = { opportunityId: id };
  if (type) where.type = type;
  const items = await prisma.document.findMany({
    where,
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ssnSafeJson(items);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Opportunity.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;
  if (!await canAccessRecord("opportunity", id)) return Response.json({ error: "Not found" }, { status: 404 });

  const opp = await prisma.opportunity.findUnique({ where: { id } });
  if (!opp) return ssnSafeJson({ error: "Opportunity not found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  const type = (form.get("type") as string) || "OTHER";
  if (!(file instanceof File)) {
    return ssnSafeJson({ error: "No file" }, { status: 400 });
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
      // Absolute path: uploads live on the /data volume, not under cwd.
      filePath,
      fileSize: buf.byteLength,
      uploadedById: session.userId,
    },
  });

  return ssnSafeJson(doc);
}
