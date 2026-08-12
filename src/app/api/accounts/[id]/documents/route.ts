import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { uploadRoot } from "@/lib/upload-storage";


const UPLOAD_ROOT = uploadRoot("accounts");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Account.View");
  if ("response" in r) return r.response;
  const { id } = await params;
  const items = await prisma.document.findMany({
    where: { accountId: id },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAuthOrRespond("Account.Edit");
  if ("response" in r) return r.response;
  const { session } = r;
  const { id } = await params;

  const acct = await prisma.account.findUnique({ where: { id } });
  if (!acct) return NextResponse.json({ error: "Account not found" }, { status: 404 });

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
      accountId: id,
      name: file.name,
      type,
      // Absolute path: uploads live on the /data volume, not under cwd.
      filePath,
      fileSize: buf.byteLength,
      uploadedById: session.userId,
    },
  });

  return NextResponse.json(doc);
}
