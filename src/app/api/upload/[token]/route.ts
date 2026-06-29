import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { sendESignEmail } from "@/lib/esign/send-email";
import { appBaseUrl } from "@/lib/document-request";

// Public (no-login) endpoint. The token is the only secret.
const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "opportunities");
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per file

async function loadRequest(token: string) {
  return prisma.documentRequest.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      status: true,
      expiresAt: true,
      recipientName: true,
      opportunityId: true,
      accountId: true,
      createdById: true,
      uploadCount: true,
    },
  });
}

function liveState(req: { status: string; expiresAt: Date | null }): "OK" | "EXPIRED" | "CLOSED" {
  if (req.status === "CANCELLED") return "CLOSED";
  if (req.expiresAt && req.expiresAt.getTime() < Date.now()) return "EXPIRED";
  return "OK";
}

// GET — public metadata so the upload page can render (or show expired).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const req = await loadRequest(token);
  if (!req) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    recipientName: req.recipientName,
    state: liveState(req),
    uploadCount: req.uploadCount,
  });
}

// POST — accept one file (the client posts each file separately). Files are
// filed onto the Opportunity AND its Account as normal Document records.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const req = await loadRequest(token);
  if (!req) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const state = liveState(req);
  if (state !== "OK") return NextResponse.json({ error: state.toLowerCase() }, { status: 410 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${Date.now()}_${safeName}`;
  const oppKey = req.opportunityId ?? req.id;
  const dir = path.join(UPLOAD_ROOT, oppKey);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, storedName);
  await fs.writeFile(filePath, buf);
  const relPath = path.relative(process.cwd(), filePath);

  // One physical file, a Document row on the Opportunity and on the Account so
  // it shows in both Files lists. uploadedBy = the rep who sent the request.
  const common = {
    name: file.name,
    type: "CLIENT_UPLOAD",
    filePath: relPath,
    fileSize: buf.byteLength,
    uploadedById: req.createdById,
  };
  if (req.opportunityId) {
    await prisma.document.create({ data: { ...common, opportunityId: req.opportunityId } });
  }
  if (req.accountId) {
    await prisma.document.create({ data: { ...common, accountId: req.accountId } });
  }

  await prisma.documentRequest.update({
    where: { id: req.id },
    data: { uploadCount: { increment: 1 }, status: "COMPLETED", completedAt: new Date() },
  });

  // Notify the rep (in-app + email). Best-effort: never fail the upload on this.
  try {
    const url = req.opportunityId ? `/opportunities/${req.opportunityId}` : "/";
    const who = req.recipientName || "A client";
    await prisma.notification.create({
      data: {
        recipientId: req.createdById,
        kind: "GENERIC",
        title: `${who} uploaded a document`,
        body: file.name,
        url,
        entityType: req.opportunityId ? "Opportunity" : "Account",
        entityId: req.opportunityId ?? req.accountId ?? undefined,
      },
    });
    const rep = await prisma.user.findUnique({
      where: { id: req.createdById },
      select: { email: true, name: true },
    });
    if (rep?.email) {
      const from = process.env.EMAIL_FROM ?? "Coastal Debt <no-reply@coastaldebt.com>";
      await sendESignEmail({
        from,
        to: rep.email,
        subject: `${who} uploaded a document`,
        html: `<p>${who} uploaded <strong>${file.name}</strong>.</p>
<p><a href="${appBaseUrl()}${url}">Open in the CRM</a></p>`,
      });
    }
  } catch {
    // ignore notification failures
  }

  return NextResponse.json({ ok: true, name: file.name });
}
