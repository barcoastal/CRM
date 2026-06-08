import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { readFile } from "@/lib/files/storage";

// Public share download endpoint. No auth required, but token must be valid,
// not revoked, not expired, and password must match if set.
//
// GET /api/files/share/[token]?p=PASSWORD  — download
// HEAD /api/files/share/[token]            — quick validity check (no password)

interface RouteCtx { params: Promise<{ token: string }> }

async function loadShare(token: string) {
  return prisma.contentShareLink.findUnique({
    where: { token },
    include: { document: { include: { latestVersion: true } } },
  });
}

function checkAvailability(
  share: Awaited<ReturnType<typeof loadShare>>,
): NextResponse | null {
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (share.isRevoked) return NextResponse.json({ error: "This link has been revoked" }, { status: 410 });
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }
  if (!share.document.latestVersion) {
    return NextResponse.json({ error: "No file available" }, { status: 404 });
  }
  return null;
}

export async function HEAD(_req: NextRequest, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const share = await loadShare(token);
  const err = checkAvailability(share);
  if (err) return err;
  return new NextResponse(null, { status: 200 });
}

async function streamFile(
  share: NonNullable<Awaited<ReturnType<typeof loadShare>>>,
): Promise<NextResponse> {
  const version = share.document.latestVersion!;
  let bytes: Buffer;
  try {
    bytes = await readFile(version.storagePath);
  } catch {
    return NextResponse.json({ error: "File missing from storage" }, { status: 410 });
  }
  // Increment download counter (best-effort).
  await prisma.contentShareLink
    .update({ where: { id: share.id }, data: { downloadCount: { increment: 1 } } })
    .catch(() => null);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": version.contentType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(version.filename)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const share = await loadShare(token);
  const err = checkAvailability(share);
  if (err) return err;
  const s = share!;
  if (s.passwordHash) {
    const url = new URL(req.url);
    const p = url.searchParams.get("p");
    if (!p) return NextResponse.json({ error: "Password required" }, { status: 401 });
    const ok = await compare(p, s.passwordHash);
    if (!ok) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  return streamFile(s);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const share = await loadShare(token);
  const err = checkAvailability(share);
  if (err) return err;
  const s = share!;
  if (s.passwordHash) {
    let body: { password?: string } = {};
    try {
      body = await req.json();
    } catch {
      const form = await req.formData().catch(() => null);
      if (form) body = { password: String(form.get("password") ?? "") };
    }
    const p = body.password;
    if (!p) return NextResponse.json({ error: "Password required" }, { status: 401 });
    const ok = await compare(p, s.passwordHash);
    if (!ok) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  return streamFile(s);
}
