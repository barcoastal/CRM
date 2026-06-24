import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRespond } from "@/lib/api-auth";
import { auditWrite } from "@/lib/audit";
import { deleteTemplatePdf } from "@/lib/esign/storage";
import { MERGE_PATH_VALUES, RECORD_TYPES } from "@/lib/esign/merge-paths";

interface BoxInput {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

function sanitizeBoxes(input: unknown): BoxInput[] {
  if (!Array.isArray(input)) return [];
  const out: BoxInput[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const page = Number(r.page);
    const x = Number(r.x);
    const y = Number(r.y);
    const width = Number(r.width);
    const height = Number(r.height);
    if (!Number.isFinite(page) || page < 1) continue;
    if (![x, y, width, height].every((n) => Number.isFinite(n))) continue;
    out.push({
      page: Math.round(page),
      x,
      y,
      width,
      height,
      label: typeof r.label === "string" ? r.label : undefined,
    });
  }
  return out;
}

function sanitizeMergeMapping(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof k !== "string" || !k) continue;
    if (v === "" || v === null || v === undefined) {
      out[k] = "";
      continue;
    }
    if (typeof v !== "string") continue;
    if (!MERGE_PATH_VALUES.has(v)) continue;
    out[k] = v;
  }
  return out;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const tpl = await prisma.envelopeTemplate.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(tpl);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const before = await prisma.envelopeTemplate.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.recordType === "string") {
    if (!(RECORD_TYPES as readonly string[]).includes(body.recordType)) {
      return NextResponse.json({ error: "Invalid recordType" }, { status: 400 });
    }
    data.recordType = body.recordType;
  }
  if (body.description === null) data.description = null;
  else if (typeof body.description === "string") data.description = body.description.trim() || null;

  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (body.mergeMapping !== undefined) data.mergeMapping = sanitizeMergeMapping(body.mergeMapping);
  if (body.signatureBoxes !== undefined) data.signatureBoxes = sanitizeBoxes(body.signatureBoxes);
  if (body.initialBoxes !== undefined) data.initialBoxes = sanitizeBoxes(body.initialBoxes);
  if (body.dateBoxes !== undefined) data.dateBoxes = sanitizeBoxes(body.dateBoxes);
  if (body.textBoxes !== undefined) data.textBoxes = sanitizeBoxes(body.textBoxes);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const after = await prisma.envelopeTemplate.update({ where: { id }, data });

  await auditWrite({
    userId: r.session.userId,
    entity: "EnvelopeTemplate",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
  });

  return NextResponse.json(after);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const r = await requireAuthOrRespond();
  if ("response" in r) return r.response;
  const { id } = await ctx.params;

  const before = await prisma.envelopeTemplate.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.envelopeTemplate.delete({ where: { id } });
  await deleteTemplatePdf(before.pdfPath);

  await auditWrite({
    userId: r.session.userId,
    entity: "EnvelopeTemplate",
    entityId: id,
    action: "DELETE",
    before: { name: before.name, pdfFilename: before.pdfFilename },
  });

  return NextResponse.json({ ok: true });
}
