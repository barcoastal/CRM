/** Report folders (SF-style). POST creates one; GET lists. */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  return NextResponse.json({ folders: await prisma.reportFolder.findMany({ orderBy: { name: "asc" } }) });
}

export async function POST(req: NextRequest) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "Folder name required" }, { status: 400 });
  const folder = await prisma.reportFolder.upsert({ where: { name }, update: {}, create: { name } });
  return NextResponse.json({ ok: true, folder });
}
